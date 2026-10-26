import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../state/chat_provider.dart';
import 'emoji_picker.dart';
import 'file_picker_widget.dart';

/// Input panel state
enum InputPanelState { none, keyboard, emoji }

/// Message input widget
class MessageInput extends StatefulWidget {
  final ChatProvider provider;
  final VoidCallback? onSend;
  final bool fullScreen;

  const MessageInput({
    super.key,
    required this.provider,
    this.onSend,
    this.fullScreen = false,
  });

  @override
  State<MessageInput> createState() => _MessageInputState();
}

class _MessageInputState extends State<MessageInput> {
  final TextEditingController _controller = TextEditingController();
  final FocusNode _focusNode = FocusNode();
  bool _hasText = false;
  
  // Core state management
  InputPanelState _panelState = InputPanelState.none;
  double _cachedKeyboardHeight = 280; // Cached keyboard height

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onTextChanged);
    _focusNode.addListener(_onFocusChanged);
    widget.provider.addListener(_onProviderChanged);
  }

  @override
  void dispose() {
    _controller.removeListener(_onTextChanged);
    _focusNode.removeListener(_onFocusChanged);
    _controller.dispose();
    _focusNode.dispose();
    widget.provider.removeListener(_onProviderChanged);
    super.dispose();
  }

  void _onFocusChanged() {
    if (_focusNode.hasFocus) {
      // When focus is gained, make sure the state switches to keyboard
      if (_panelState != InputPanelState.keyboard) {
        setState(() => _panelState = InputPanelState.keyboard);
      }
    }
  }

  void _onProviderChanged() {
    if (mounted) setState(() {});
  }

  void _onTextChanged() {
    final hasText = _controller.text.trim().isNotEmpty;
    if (hasText != _hasText) {
      setState(() => _hasText = hasText);
    }
  }

  void _toggleEmoji() {
    if (_panelState == InputPanelState.emoji) {
      // Currently showing emoji -> switch to the keyboard
      setState(() => _panelState = InputPanelState.keyboard);
      _focusNode.requestFocus();
    } else {
      // Switch to emoji
      setState(() => _panelState = InputPanelState.emoji);
      _focusNode.unfocus();
      SystemChannels.textInput.invokeMethod('TextInput.hide');
      HapticFeedback.selectionClick();
    }
  }

  void _sendMessage() async {
    final text = _controller.text.trim();
    if (text.isEmpty) return;

    HapticFeedback.mediumImpact();

    if (widget.provider.state.isStreaming) {
      await widget.provider.cancelStreaming(reason: 'auto_cancel_on_new_send');
    }

    _controller.clear();
    widget.onSend?.call();
    
    // Keep the panel state after sending
    if (_panelState == InputPanelState.keyboard) {
      _focusNode.requestFocus();
    }

    await widget.provider.sendMessage(text);
  }

  void _insertEmoji(String emoji) {
    final text = _controller.text;
    final selection = _controller.selection;
    final start = selection.start >= 0 ? selection.start : text.length;
    final end = selection.end >= 0 ? selection.end : text.length;

    final newText = text.replaceRange(start, end, emoji);
    _controller.value = TextEditingValue(
      text: newText,
      selection: TextSelection.collapsed(offset: start + emoji.length),
    );
    HapticFeedback.lightImpact();
  }

  void _deleteLastChar() {
    final text = _controller.text;
    if (text.isEmpty) return;
    
    final selection = _controller.selection;
    final start = selection.start >= 0 ? selection.start : text.length;
    final end = selection.end >= 0 ? selection.end : text.length;

    if (start == end) {
      if (start == 0) return;
      // Use characters to handle UTF-16 surrogate pairs so one emoji needs only one delete
      final textBefore = text.substring(0, start).characters;
      final textAfter = text.substring(start);
      if (textBefore.isEmpty) return;

      final newTextBefore = textBefore.skipLast(1).toString();
      _controller.value = TextEditingValue(
        text: newTextBefore + textAfter,
        selection: TextSelection.collapsed(offset: newTextBefore.length),
      );
    } else {
      final newText = text.replaceRange(start, end, '');
      _controller.value = TextEditingValue(
        text: newText,
        selection: TextSelection.collapsed(offset: start),
      );
    }
    HapticFeedback.lightImpact();
  }

  void _cancelStream() {
    HapticFeedback.selectionClick();
    widget.provider.cancelStreaming(reason: 'user_click');
  }

  @override
  Widget build(BuildContext context) {
    final isStreaming = widget.provider.state.isStreaming;
    final viewInsetsBottom = MediaQuery.of(context).viewInsets.bottom;
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    
    // Update the keyboard height cache: only record a "valid keyboard height" and do not write a near-0 value into the cache at the tail end of the keyboard collapsing.
    // While the iOS keyboard collapses, viewInsetsBottom shrinks to 0 frame by frame; if it kept being written back, the emoji panel height would later become ~bottomPadding and cause an overflow.
    const double kMinValidKeyboardHeight = 80; // Threshold: values below this are treated as end-of-collapse noise
    if (_panelState == InputPanelState.keyboard &&
        viewInsetsBottom >= kMinValidKeyboardHeight) {
      _cachedKeyboardHeight = max(_cachedKeyboardHeight, viewInsetsBottom);
    }

    // When the keyboard is fully collapsed and the input has lost focus, converge the state from keyboard to none so later logic does not wrongly assume "still in keyboard mode"
    if (_panelState == InputPanelState.keyboard &&
        viewInsetsBottom == 0 &&
        !_focusNode.hasFocus) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        if (_panelState == InputPanelState.keyboard &&
            !_focusNode.hasFocus &&
            MediaQuery.of(context).viewInsets.bottom == 0) {
          setState(() => _panelState = InputPanelState.none);
        }
      });
    }

    // Compute the bottom panel height from the state
    double panelHeight;
    switch (_panelState) {
      case InputPanelState.none:
        panelHeight = bottomPadding;
        break;
      case InputPanelState.keyboard:
        // In keyboard mode, the height is the max of viewInsetsBottom and bottomPadding
        panelHeight = max(viewInsetsBottom, bottomPadding);
        break;
      case InputPanelState.emoji:
        // In emoji mode, the height is fixed to the cached keyboard height plus the bottom safe inset
        panelHeight = _cachedKeyboardHeight + bottomPadding;
        break;
    }

    final isEmojiMode = _panelState == InputPanelState.emoji;

    return TapRegion(
      onTapOutside: (_) {
        if (!mounted) return;
        if (_panelState != InputPanelState.none) {
          setState(() => _panelState = InputPanelState.none);
        }
        if (_focusNode.hasFocus) {
          _focusNode.unfocus();
        }
      },
      child: Container(
        decoration: const BoxDecoration(
          color: Color(0xFFF6F6F6),
          border: Border(
            top: BorderSide(color: Color(0xFFEBEBEB), width: 0.5),
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
          // Input bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                // Input Field
                Expanded(
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 1),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: TextField(
                      controller: _controller,
                      focusNode: _focusNode,
                      maxLines: 4,
                      minLines: 1,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _sendMessage(),
                      style: const TextStyle(
                        color: Color(0xFF181818),
                        fontSize: 16,
                        height: 1.25,
                        textBaseline: TextBaseline.alphabetic,
                      ),
                      decoration: const InputDecoration(
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        contentPadding: EdgeInsets.symmetric(vertical: 9),
                        isDense: true,
                      ),
                    ),
                  ),
                ),

                // Emoji button
                _PressableButton(
                  onPressed: _toggleEmoji,
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 150),
                    child: Icon(
                      isEmojiMode ? Icons.keyboard_alt_rounded : Icons.emoji_emotions_outlined,
                      key: ValueKey(isEmojiMode),
                      color: const Color(0xFF181818),
                      size: 26,
                    ),
                  ),
                ),

                // Plus / Send button
                SizedBox(
                  width: _hasText || isStreaming ? 64 : 40,
                  height: 40,
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 200),
                    switchInCurve: Curves.easeOutBack,
                    switchOutCurve: Curves.easeIn,
                    transitionBuilder: (child, animation) {
                      return ScaleTransition(
                        scale: animation,
                        child: FadeTransition(opacity: animation, child: child),
                      );
                    },
                    child: isStreaming
                        ? _WeChatSendButton(
                            key: const ValueKey('stop'),
                            label: 'Stop',
                            onPressed: _cancelStream,
                            isStop: true,
                          )
                        : _hasText
                            ? _WeChatSendButton(
                                key: const ValueKey('send'),
                                label: 'Send',
                                onPressed: _sendMessage,
                              )
                            : _PressableButton(
                                key: const ValueKey('add'),
                                onPressed: () {
                                  HapticFeedback.selectionClick();
                                  FilePickerHelper.showPicker(context, widget.provider);
                                },
                                child: const Icon(
                                  Icons.add_circle,
                                  color: Color(0xFF181818),
                                  size: 26,
                                ),
                              ),
                  ),
                ),
              ],
            ),
          ),

          // Bottom panel placeholder
          AnimatedContainer(
            // The keyboard already has a system-level animation; adding a 200ms easing here would produce a "reverse bounce/jitter" feel at the tail end.
            // Therefore: disable this container's animation in keyboard state so the height strictly follows viewInsetsBottom; only emoji/none get the smooth animation.
            duration: _panelState == InputPanelState.keyboard
                ? Duration.zero
                : const Duration(milliseconds: 200),
            curve: Curves.easeOutCubic,
            height: panelHeight,
            child: isEmojiMode
                ? ClipRect(
                    child: OverflowBox(
                      minHeight: 0,
                      maxHeight: _cachedKeyboardHeight + bottomPadding,
                      alignment: Alignment.topCenter,
                      child: SizedBox(
                        height: _cachedKeyboardHeight + bottomPadding,
                        child: EmojiPicker(
                          onEmojiSelected: _insertEmoji,
                          onDelete: _deleteLastChar,
                          onSend: _hasText ? _sendMessage : null,
                          onClose: () => setState(() => _panelState = InputPanelState.none),
                        ),
                      ),
                    ),
                  )
                : const SizedBox.shrink(),
          ),
          ],
        ),
      ),
    );
  }
}

class _PressableButton extends StatefulWidget {
  final Widget child;
  final VoidCallback onPressed;

  const _PressableButton({
    super.key,
    required this.child,
    required this.onPressed,
  });

  @override
  State<_PressableButton> createState() => _PressableButtonState();
}

class _PressableButtonState extends State<_PressableButton> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _isPressed = true),
      onTapUp: (_) => setState(() => _isPressed = false),
      onTapCancel: () => setState(() => _isPressed = false),
      onTap: widget.onPressed,
      behavior: HitTestBehavior.opaque,
      child: AnimatedScale(
        scale: _isPressed ? 0.92 : 1.0,
        duration: const Duration(milliseconds: 100),
        child: Container(
          width: 40,
          height: 40,
          alignment: Alignment.center,
          child: widget.child,
        ),
      ),
    );
  }
}

class _WeChatSendButton extends StatefulWidget {
  final String label;
  final VoidCallback onPressed;
  final bool isStop;

  const _WeChatSendButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.isStop = false,
  });

  @override
  State<_WeChatSendButton> createState() => _WeChatSendButtonState();
}

class _WeChatSendButtonState extends State<_WeChatSendButton> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    final bgColor = widget.isStop 
        ? const Color(0xFFFA5151) 
        : const Color(0xFF07C160);
    
    return GestureDetector(
      onTapDown: (_) => setState(() => _isPressed = true),
      onTapUp: (_) => setState(() => _isPressed = false),
      onTapCancel: () => setState(() => _isPressed = false),
      onTap: widget.onPressed,
      child: AnimatedScale(
        scale: _isPressed ? 0.95 : 1.0,
        duration: const Duration(milliseconds: 100),
        child: Container(
          height: 34,
          margin: const EdgeInsets.only(bottom: 3),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: _isPressed ? bgColor.withOpacity(0.8) : bgColor,
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text(
            widget.label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }
}
