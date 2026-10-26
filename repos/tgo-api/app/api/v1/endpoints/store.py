from typing import Any, List, Optional
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import get_db
from app.core.config import settings
from app.core.security import get_current_active_user
from app.core.logging import get_logger
from app.models.store_credential import StoreCredential
from app.models.staff import Staff
from app.schemas.store import (
    StoreCredential as StoreCredentialSchema, 
    StoreInstallRequest,
    StoreBindRequest,
    StoreAgentDetail,
    StoreToolSummary,
    AgentDependencyCheckResponse,
    StoreInstallAgentRequest
)
from app.schemas.tools import ToolCreateRequest, ToolType as CoreToolType, ToolSourceType
from app.utils.crypto import encrypt_str, decrypt_str
from app.services.store_client import store_client
from app.services.ai_client import ai_client
from app.services.ai_provider_sync import sync_provider_with_retry_and_update

logger = get_logger("endpoints.store")

router = APIRouter()


@router.post("/bind", response_model=StoreCredentialSchema)
async def bind_store(
    bind_in: StoreBindRequest,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_active_user),
) -> Any:
    """
    Bind a store to the current project
    1. Call the store's /auth/api-key with the access_token to obtain an api_key
    2. Save it to api_store_credentials
    """
    project_id = current_user.project_id
    # 1. Call the store to obtain an api_key
    try:
        result = await store_client.get_api_key(bind_in.access_token)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch API Key from Store: {str(e)}"
        )

    # 2. Check whether credentials already exist
    credential = db.scalar(
        select(StoreCredential).where(StoreCredential.project_id == project_id)
    )
    
    if credential:
        credential.store_user_id = result["user_id"]
        credential.store_email = result["email"]
        credential.api_key_encrypted = encrypt_str(result["api_key"])
    else:
        credential = StoreCredential(
            project_id=project_id,
            store_user_id=result["user_id"],
            store_email=result["email"],
            api_key_encrypted=encrypt_str(result["api_key"]),
        )
        db.add(credential)
    
    db.commit()
    db.refresh(credential)
    return credential


async def _install_tool_internal(resource_id: str, project_id: UUID, api_key: str) -> Any:
    """Internal helper to install a tool from store"""
    # 1. Call the store API to get tool details
    try:
        tool_detail = await store_client.get_tool(resource_id, api_key)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch tool from Store: {str(e)}"
        )

    # 2. Build the local tool creation request
    config = tool_detail.get("config", {})
    # Make sure config contains inputSchema
    if "input_schema" in tool_detail and "inputSchema" not in config:
        config["inputSchema"] = tool_detail["input_schema"]
    
    # Store the description as a backup
    if (tool_detail.get("description_zh") or tool_detail.get("description")) and "description" not in config:
        config["description"] = tool_detail.get("description_zh") or tool_detail.get("description")

    tool_create = ToolCreateRequest(
        name=tool_detail["name"],
        title=tool_detail.get("title") or tool_detail.get("title_zh") or tool_detail["name"],
        title_zh=tool_detail.get("title_zh"),
        title_en=tool_detail.get("title_en"),
        description=tool_detail.get("description_zh") or tool_detail.get("description"),
        tool_type=CoreToolType.MCP,
        transport_type="http",
        endpoint=f"{settings.STORE_SERVICE_URL.rstrip('/')}/api/v1/mcp/{resource_id}/http",
        tool_source_type=ToolSourceType.STORE,
        store_resource_id=resource_id,
        config=config
    )

    # 3. Create the ai_tools record in tgo-ai
    try:
        tool_data_dict = tool_create.model_dump(exclude_none=True)
        tool_data_dict["project_id"] = str(project_id)
        
        result = await ai_client.create_tool(tool_data=tool_data_dict)
        
        # Record the store installation
        await store_client.install_tool(resource_id, api_key)
        
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create tool in AI service: {str(e)}"
        )


async def _install_model_internal(resource_id: str, project_id: UUID, api_key: str, db: Session) -> Any:
    """Internal helper to install a model from store"""
    # 1. Call the store API to get model details
    try:
        model_detail = await store_client.get_model(resource_id, api_key)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch model from Store: {str(e)}"
        )

    # 2. Make sure a local "Store" type LLMProvider exists
    from app.models import AIProvider
    provider_name = f"Store-{model_detail.provider.name}"
    local_model_id = model_detail.name

    provider = db.scalar(
        select(AIProvider).where(
            AIProvider.project_id == project_id,
            AIProvider.name == provider_name,
            AIProvider.deleted_at.is_(None)
        )
    )
    
    if not provider:
        provider = AIProvider(
            project_id=project_id,
            provider="openai_compatible",
            name=provider_name,
            api_base_url=f"{settings.STORE_SERVICE_URL.rstrip('/')}/api/v1",
            api_key=encrypt_str(api_key),
            is_active=True,
            default_model=local_model_id,
            is_from_store=True,
            store_resource_id=model_detail.provider.id
        )
        db.add(provider)
    else:
        provider.is_from_store = True
        provider.store_resource_id = model_detail.provider.id
        provider.api_base_url = f"{settings.STORE_SERVICE_URL.rstrip('/')}/api/v1"
        if not provider.default_model:
            provider.default_model = local_model_id
        db.add(provider)
    
    db.flush()

    # 3. Create the local model record
    from app.models import AIModel
    existing_model = db.scalar(
        select(AIModel).where(
            AIModel.provider_id == provider.id,
            AIModel.model_id == local_model_id,
            AIModel.deleted_at.is_(None)
        )
    )
    
    if not existing_model:
        existing_model = AIModel(
            provider_id=provider.id,
            provider="openai_compatible",
            model_id=local_model_id,
            model_name=model_detail.title_zh or model_detail.name,
            model_type=model_detail.model_type,
            description=model_detail.description_zh,
            is_active=True,
            capabilities=model_detail.config.get("capabilities", {}) if model_detail.config else {},
            store_resource_id=resource_id
        )
        db.add(existing_model)
        # Ensure it's associated in the relationship for immediate sync
        if existing_model not in provider.models:
            provider.models.append(existing_model)
    else:
        existing_model.model_name = model_detail.title_zh or model_detail.name
        existing_model.model_type = model_detail.model_type
        existing_model.description = model_detail.description_zh
        existing_model.capabilities = model_detail.config.get("capabilities", {}) if model_detail.config else {}
        existing_model.store_resource_id = resource_id
        db.add(existing_model)
    
    # Record the store installation
    try:
        await store_client.install_model(resource_id, api_key)
    except Exception as e:
        logger.warning(f"Failed to record installation in store: {str(e)}")
    
    db.commit()
    db.refresh(provider)

    # Sync provider to tgo-ai service
    ok, err = await sync_provider_with_retry_and_update(db, provider)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to sync provider to AI service: {err}"
        )

    return {"success": True, "model_id": local_model_id, "provider": provider_name}


@router.post("/install-tool", response_model=Any)
async def install_tool_from_store(
    install_in: StoreInstallRequest,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_active_user),
) -> Any:
    """Install a tool from the store into the project"""
    project_id = current_user.project_id
    # 1. Get the store credentials bound to the project
    credential = db.scalar(
        select(StoreCredential).where(StoreCredential.project_id == project_id)
    )
    if not credential:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project not bound to Store. Please bind credentials first."
        )
    
    api_key = decrypt_str(credential.api_key_encrypted)
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to decrypt Store API Key"
        )

    return await _install_tool_internal(install_in.resource_id, project_id, api_key)


@router.delete("/uninstall-tool/{resource_id}")
async def uninstall_tool_from_store(
    resource_id: str,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_active_user),
) -> Any:
    """Uninstall a store tool from the local project"""
    project_id = current_user.project_id
    # 1. Find the matching local store tool
    local_tools = await ai_client.list_tools(project_id=str(project_id))
    target_tool = next((t for t in local_tools if t.get("store_resource_id") == resource_id), None)
    
    if not target_tool:
        raise HTTPException(status_code=404, detail="Tool not found in this project")

    # 2. Call the store API to record the uninstall
    credential = db.scalar(
        select(StoreCredential).where(StoreCredential.project_id == project_id)
    )
    if credential:
        api_key = decrypt_str(credential.api_key_encrypted)
        if api_key:
            try:
                await store_client.uninstall_tool(resource_id, api_key)
            except Exception:
                # A store uninstall failure does not block the local uninstall
                pass

    # 3. Delete the ai_tools record in tgo-ai
    try:
        await ai_client.delete_tool(
            project_id=str(project_id),
            tool_id=target_tool["id"]
        )
        return {"success": True}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete tool in AI service: {str(e)}"
        )

# --- Model Installation ---

@router.post("/install-model", response_model=Any)
async def install_model_from_store(
    install_in: StoreInstallRequest,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_active_user),
) -> Any:
    """Install a model from the store into the project"""
    project_id = current_user.project_id
    # 1. Get the store credentials bound to the project
    credential = db.scalar(
        select(StoreCredential).where(StoreCredential.project_id == project_id)
    )
    if not credential:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project not bound to Store. Please bind credentials first."
        )
    
    api_key = decrypt_str(credential.api_key_encrypted)
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to decrypt Store API Key"
        )

    return await _install_model_internal(install_in.resource_id, project_id, api_key, db)


@router.delete("/uninstall-model/{resource_id}")
async def uninstall_model_from_store(
    resource_id: str,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_active_user),
) -> Any:
    """Uninstall a store model from the local project"""
    project_id = current_user.project_id
    
    # 1. Get the store credentials bound to the project
    credential = db.scalar(
        select(StoreCredential).where(StoreCredential.project_id == project_id)
    )
    if not credential:
        raise HTTPException(status_code=400, detail="Project not bound to Store")
        
    api_key = decrypt_str(credential.api_key_encrypted)
    if not api_key:
        raise HTTPException(status_code=500, detail="Failed to decrypt API Key")

    # 2. Call the store API to get model details to obtain the local identifier (model_name)
    try:
        model_detail = await store_client.get_model(resource_id, api_key)
        local_model_id = model_detail.name
    except Exception as e:
        logger.error(f"Failed to fetch model detail from store during uninstall: {str(e)}")
        # If the store cannot find it, try to infer it from resource_id (this may be inaccurate, since we now store by name)
        # Or we could look for a prefix-matching model in the local database, but that is unreliable
        raise HTTPException(status_code=502, detail="Failed to fetch model info from store")

    # 3. Call the store API to record the uninstall
    try:
        await store_client.uninstall_model(resource_id, api_key)
    except Exception as e:
        logger.warning(f"Failed to record uninstallation in store: {str(e)}")

    # 4. Remove from the model records associated with the AIProvider
    from app.models import AIProvider, AIModel
    # Find the Store Providers of this project
    providers = db.scalars(
        select(AIProvider).where(
            AIProvider.project_id == project_id,
            AIProvider.name.like("Store-%"),
            AIProvider.deleted_at.is_(None)
        )
    ).all()
    
    for provider in providers:
        # Find the matching models under this Provider
        model = db.scalar(
            select(AIModel).where(
                AIModel.provider_id == provider.id,
                AIModel.model_id == local_model_id,
                AIModel.deleted_at.is_(None)
            )
        )
        if model:
            db.delete(model)
            
            # If the deleted one was the default model, pick another or clear it
            if provider.default_model == local_model_id:
                db.flush() # Make sure the delete is synced
                remaining = db.scalar(
                    select(AIModel.model_id).where(
                        AIModel.provider_id == provider.id,
                        AIModel.deleted_at.is_(None)
                    ).limit(1)
                )
                provider.default_model = remaining
                db.add(provider)
            
            # Record the Providers that need syncing
            db.commit() # Commit the model deletion first
            try:
                await sync_provider_with_retry_and_update(db, provider)
            except Exception as e:
                logger.warning(f"Failed to sync provider to AI service after model uninstall: {str(e)}")

    return {"success": True}


@router.get("/installed-models", response_model=List[str])
async def list_installed_models(
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_active_user),
) -> Any:
    """List all store models installed in the current project (identifier list only)"""
    project_id = current_user.project_id
    
    # Find installed models via the associated Provider
    try:
        from app.models import AIProvider, AIModel
        
        # We only need model_id (the name in the store)
        # Explicitly convert to a list of strings to avoid leaking Row objects
        model_ids = db.scalars(
            select(AIModel.model_id)
            .join(AIProvider, AIModel.provider_id == AIProvider.id)
            .where(
                AIProvider.project_id == project_id,
                AIProvider.name.like("Store-%"),
                AIModel.deleted_at.is_(None),
                AIProvider.deleted_at.is_(None)
            )
        ).all()
        return [str(mid) for mid in model_ids]
    except Exception as e:
        logger.error(f"Failed to list installed models: {str(e)}")
        return []


@router.get("/agent/{agent_id}/check-dependencies", response_model=AgentDependencyCheckResponse)
async def check_agent_dependencies(
    agent_id: str,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_active_user),
) -> Any:
    """Check whether the tools and models the employee depends on are installed"""
    project_id = current_user.project_id
    
    # 1. Get the store credentials bound to the project
    credential = db.scalar(
        select(StoreCredential).where(StoreCredential.project_id == project_id)
    )
    if not credential:
        raise HTTPException(status_code=400, detail="Project not bound to Store")
    
    api_key = decrypt_str(credential.api_key_encrypted)
    if not api_key:
        raise HTTPException(status_code=500, detail="Failed to decrypt Store API Key")

    # 2. Call the store API to get employee details
    try:
        agent_template = await store_client.get_agent(agent_id, api_key)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch agent template from Store: {str(e)}"
        )

    # 3. Check installed tools
    local_tools = await ai_client.list_tools(project_id=str(project_id))
    installed_store_tool_ids = {t.get("store_resource_id") for t in local_tools if t.get("store_resource_id")}
    
    missing_tools = []
    if agent_template.recommended_tools:
        for tool_id in agent_template.recommended_tools:
            if tool_id not in installed_store_tool_ids:
                try:
                    tool_detail = await store_client.get_tool(tool_id, api_key)
                    missing_tools.append(StoreToolSummary(
                        id=tool_id,
                        name=tool_detail["name"],
                        title_zh=tool_detail.get("title_zh") or tool_detail.get("name"),
                        price_per_call=tool_detail.get("price_per_call", 0)
                    ))
                except Exception as e:
                    logger.warning(f"Failed to fetch tool {tool_id} details: {str(e)}")
                    # Mark as missing even if fetching failed, keeping only the ID and a basic placeholder
                    missing_tools.append(StoreToolSummary(
                        id=tool_id,
                        name="Unknown Tool",
                        title_zh=f"Unknown Tool ({tool_id[:8]})"
                    ))

    # 4. Check installed models
    from app.models import AIModel, AIProvider
    missing_model = None
    if agent_template.model_id:
        # The model must not be deleted, its Provider must not be deleted, and it must belong to the current project
        existing_model = db.scalar(
            select(AIModel)
            .join(AIProvider, AIModel.provider_id == AIProvider.id)
            .where(AIModel.store_resource_id == agent_template.model_id)
            .where(AIModel.deleted_at.is_(None))
            .where(AIProvider.deleted_at.is_(None))
            .where(AIProvider.project_id == project_id)
        )
        if not existing_model:
            missing_model = agent_template.model

    return {
        "agent": agent_template,
        "missing_tools": missing_tools,
        "missing_model": missing_model
    }


@router.post("/install-agent", response_model=Any)
async def install_agent_from_store(
    install_in: StoreInstallAgentRequest,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_active_user),
) -> Any:
    """Hire an AI employee from the store into the project"""
    project_id = current_user.project_id
    # 1. Get the store credentials bound to the project
    credential = db.scalar(
        select(StoreCredential).where(StoreCredential.project_id == project_id)
    )
    if not credential:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project not bound to Store. Please bind credentials first."
        )
    
    api_key = decrypt_str(credential.api_key_encrypted)
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to decrypt Store API Key"
        )

    # 2. Call the store API to get AgentTemplate details
    try:
        agent_template = await store_client.get_agent(install_in.resource_id, api_key)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch agent template from Store: {str(e)}"
        )

    # 3. Batch-install the selected dependencies and collect tool IDs
    installed_tool_bindings = []
    
    # 3.1 Install tools in a loop
    if agent_template.recommended_tools:
        # Get the latest local tool list in case some tools are already installed
        local_tools = await ai_client.list_tools(project_id=str(project_id))
        store_to_local_id_map = {t.get("store_resource_id"): t.get("id") for t in local_tools if t.get("store_resource_id")}
        
        for tool_id in agent_template.recommended_tools:
            local_tool_id = store_to_local_id_map.get(tool_id)
            
            # If it is not local and the user chose to install it, or it is already local
            should_install = install_in.install_tool_ids and tool_id in install_in.install_tool_ids
            
            if not local_tool_id and should_install:
                try:
                    result = await _install_tool_internal(tool_id, project_id, api_key)
                    local_tool_id = result.get("id")
                except Exception as e:
                    logger.warning(f"Batch install: Failed to install tool {tool_id}: {str(e)}")
            
            # If a local ID exists, add it to the binding list
            if local_tool_id:
                installed_tool_bindings.append({
                    "tool_id": local_tool_id,
                    "enabled": True
                })
    
    # 3.2 Install models and get the provider ID
    associated_llm_provider_id = None
    if agent_template.model_id:
        # First check whether the local record of this store model already exists (and its Provider is not deleted)
        from app.models import AIModel, AIProvider
        existing_model = db.scalar(
            select(AIModel)
            .join(AIProvider, AIModel.provider_id == AIProvider.id)
            .where(AIModel.store_resource_id == agent_template.model_id)
            .where(AIModel.deleted_at.is_(None))
            .where(AIProvider.deleted_at.is_(None))
            .where(AIProvider.project_id == project_id)
        )
        
        # If it needs installing or already exists
        if install_in.install_model or existing_model:
            try:
                # _install_model_internal handles syncing and returns a dict with provider info
                # but we need the provider object from the database to get its UUID
                await _install_model_internal(agent_template.model_id, project_id, api_key, db)
                
                # Query again to get provider_id
                # The internal helper has already committed, so just query the latest here
                model_record = db.scalar(
                    select(AIModel)
                    .join(AIProvider, AIModel.provider_id == AIProvider.id)
                    .where(AIModel.store_resource_id == agent_template.model_id)
                    .where(AIModel.deleted_at.is_(None))
                    .where(AIProvider.deleted_at.is_(None))
                    .where(AIProvider.project_id == project_id)
                )
                if model_record:
                    associated_llm_provider_id = model_record.provider_id
            except Exception as e:
                logger.warning(f"Batch install: Failed to install/get model {agent_template.model_id}: {str(e)}")

    # 4. Call ai_client.create_agent() to create the local Agent
    try:
        agent_data = {
            "name": agent_template.title_zh or agent_template.name,
            "is_remote_store_agent": True,
            "remote_agent_url": f"{settings.STORE_SERVICE_URL.rstrip('/')}/api/v1/agentos",
            "store_agent_id": str(agent_template.id),
            "project_id": str(project_id),
            "instruction": agent_template.instruction_zh or agent_template.instruction,
            "model": agent_template.model.name if agent_template.model else "gpt-4o",
            "config": agent_template.default_config,
            "tools": installed_tool_bindings,  # Automatically link installed tools
            "llm_provider_id": str(associated_llm_provider_id) if associated_llm_provider_id else None  # Link the installed model provider
        }
        
        result = await ai_client.create_agent(
            project_id=str(project_id),
            agent_data=agent_data,
        )
        
        # 5. Record the store installation
        try:
            await store_client.install_agent(install_in.resource_id, api_key)
        except Exception as e:
            logger.warning(f"Failed to record agent installation in store: {str(e)}")
            
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create agent in AI service: {str(e)}"
        )


    return {"success": True}


@router.api_route("/proxy/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy_store_request(
    path: str,
    request: Request,
    current_user: Staff = Depends(get_current_active_user),
):
    """
    Transparent proxy for Store API requests: parameters are not parsed, requests are forwarded as-is.
    Supports GET, POST, PUT, DELETE, PATCH and other methods.
    
    Authentication handling:
    - If the request carries X-Store-Authorization, use it as the store's Authorization header
    - Otherwise remove Pelatis's Authorization header (the store does not recognize it)
    """
    # 1. Build the target URL
    target_url = f"{settings.STORE_SERVICE_URL.rstrip('/')}/api/v1/{path}"
    if request.query_params:
        target_url = f"{target_url}?{request.query_params}"

    # 2. Prepare request headers
    # Remove headers that may cause 403 from the remote server
    excluded_headers = (
        "host", 
        "content-length", 
        "authorization", 
        "origin", 
        "referer", 
        "connection",
        "accept-encoding"
    )
    headers = {k: v for k, v in request.headers.items() if k.lower() not in excluded_headers}
    
    # Spoof a browser User-Agent to avoid being blocked by a WAF
    headers["user-agent"] = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    
    # 3. Handle store authentication
    # If the frontend sent X-Store-Authorization, convert it to an Authorization header for the store
    store_auth = request.headers.get("x-store-authorization")
    if store_auth:
        headers["authorization"] = store_auth
    
    # 4. Get the request body
    body = await request.body()

    # 5. Send the request
    async with httpx.AsyncClient(timeout=settings.STORE_TIMEOUT) as client:
        try:
            # Use a streaming response to handle large files or keep performance up
            # Note: for robustness the body is not parsed and is forwarded as-is
            proxy_response = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=body,
                follow_redirects=True
            )
            
            # 5. Return the response
            return Response(
                content=proxy_response.content,
                status_code=proxy_response.status_code,
                headers={k: v for k, v in proxy_response.headers.items() if k.lower() not in ("content-encoding", "transfer-encoding", "content-length")}
            )
        except httpx.RequestError as e:
            logger.error(f"Store proxy connection error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to connect to Store service: {str(e)}"
            )
        except Exception as e:
            logger.error(f"Store proxy unexpected error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Internal error during Store proxy: {str(e)}"
            )


@router.get("/config")
async def get_store_config(
    current_user: Staff = Depends(get_current_active_user),
):
    """Return the Store service config (Web URL, etc.)"""
    return {
        "store_web_url": settings.STORE_WEB_URL,
        "store_api_url": settings.STORE_SERVICE_URL,
    }
