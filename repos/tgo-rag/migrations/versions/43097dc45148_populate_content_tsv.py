"""populate content_tsv and add trigram index for multilingual keyword search

content_tsv was never populated, so full-text keyword search never matched any
row. Add a trigger that keeps it in sync using the language-neutral 'simple'
configuration (English, Hindi and Marathi), backfill existing rows, and add a
trigram index to support substring/word-similarity matching.

Revision ID: 43097dc45148
Revises: 32097dc45147
Create Date: 2026-10-25 12:00:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '43097dc45148'
down_revision = '32097dc45147'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE OR REPLACE FUNCTION rag_file_documents_tsv_update() RETURNS trigger AS $$
        BEGIN
            NEW.content_tsv := to_tsvector(
                'simple',
                coalesce(NEW.document_title, '') || ' ' || coalesce(NEW.content, '')
            );
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql
        """
    )
    op.execute(
        """
        CREATE TRIGGER rag_file_documents_tsv_trigger
        BEFORE INSERT OR UPDATE OF content, document_title ON rag_file_documents
        FOR EACH ROW EXECUTE FUNCTION rag_file_documents_tsv_update()
        """
    )
    op.execute(
        """
        UPDATE rag_file_documents
        SET content_tsv = to_tsvector(
            'simple', coalesce(document_title, '') || ' ' || coalesce(content, '')
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_rag_file_documents_content_trgm "
        "ON rag_file_documents USING gin (content gin_trgm_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_rag_file_documents_content_trgm")
    op.execute("DROP TRIGGER IF EXISTS rag_file_documents_tsv_trigger ON rag_file_documents")
    op.execute("DROP FUNCTION IF EXISTS rag_file_documents_tsv_update()")
