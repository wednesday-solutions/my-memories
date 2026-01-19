import Cocoa
import ApplicationServices

let uiLiteralsGeneric: Set<String> = [
    "Claude", "Copy", "Retry", "Edit", "Reply...", "Opus 4.5", "Star",
    "Sonnet", "Send", "Cancel", "New chat", "Share", "Settings",
    "Copied!", "Regenerate", "Continue", "Stop generating",
    "Today", "Yesterday",
    "ChatGPT", "Chat history", "Search chats", "Images", "Apps", "Projects",
    "GPTs", "Explore GPTs", "Your chats", "Upgrade", "Log out", "Logout",
    "Skip to content", "Help", "Account", "Plans", "Billing",
    "Gemini", "History", "Recent", "Extensions", "Upload", "Sign in",
    "Privacy", "Terms", "Feedback",
    "Show thinking", "Hide thinking",
    "Gemini can make mistakes, so double-check it",
    "Gemini can make mistakes, so double-check it.",
    "Improve", "Reports", "Critique", "Write", "Focus",
    "My stuff", "Gems", "Writing editor", "Settings and help", "Chats",
    "Conversation with Gemini"
]

func getSemanticRoleForGeneric(element: AXUIElement) -> String {
    var currentElement = element
    var depth = 0
    var hasAssistantClass = false
    var hasUserClass = false
    var hasTimestampClass = false
    var isChatTitle = false
    var isUIElement = false
    var isHeader = false

    // Check the element's own role first
    var role: AnyObject?
    AXUIElementCopyAttributeValue(element, kAXRoleAttribute as CFString, &role)
    if let strRole = role as? String {
        if strRole == "AXButton" || strRole == "AXMenuItem" {
            isUIElement = true
        }
        if strRole == "AXHeading" {
            isHeader = true
        }
    }

    // Walk up the ancestry tree checking DOM classes
    var hasFontBaseBold = false

    while depth < 15 {
        var classList: AnyObject?
        AXUIElementCopyAttributeValue(currentElement, "AXDOMClassList" as CFString, &classList)

        // Check if current ancestor is a button
        var ancestorRole: AnyObject?
        AXUIElementCopyAttributeValue(currentElement, kAXRoleAttribute as CFString, &ancestorRole)
        if let r = ancestorRole as? String, r == "AXButton" {
            // If we've seen font-base-bold before this button, it's a chat title
            if hasFontBaseBold {
                isChatTitle = true
            }
        }

        if let classes = classList as? [String] {
            // Track if we've seen the title styling class
            if classes.contains("font-base-bold") {
                hasFontBaseBold = true
            }

            // === ASSISTANT MARKERS ===
            if classes.contains("font-claude-response") ||
               classes.contains("font-claude-response-body") {
                hasAssistantClass = true
            }

            // === USER MARKERS ===
            if classes.contains(where: { $0.contains("font-user-message") }) {
                hasUserClass = true
            }

            // === TIMESTAMP MARKERS ===
            if classes.contains("text-xs") && classes.contains("text-text-500") {
                hasTimestampClass = true
            }

            // === UI NOISE MARKERS ===
            if classes.contains("font-medium") ||
               classes.contains("button-ghost") ||
               classes.contains("Button_ghost__BUAoh") ||
               classes.contains("ProseMirror") ||
               classes.contains("is-empty") ||
               classes.contains("is-editor-empty") {
                isUIElement = true
            }
        }

        // Go up to parent
        var parent: AnyObject?
        AXUIElementCopyAttributeValue(currentElement, kAXParentAttribute as CFString, &parent)
        if let parentElem = parent {
            if CFGetTypeID(parentElem) == AXUIElementGetTypeID() {
                currentElement = parentElem as! AXUIElement
            } else {
                break
            }
        } else {
            break
        }
        depth += 1
    }

    // Return semantic role based on findings (order matters - most specific first)
    if isChatTitle {
        return "CHAT_TITLE"
    }
    if isUIElement {
        return "NOISE"
    }
    if hasTimestampClass {
        return "METADATA"
    }
    if isHeader {
        return "TITLE"
    }
    if hasAssistantClass {
        return "ASSISTANT"
    }
    if hasUserClass {
        return "USER"
    }

    // Fallback: No clear marker found - could be user or other content
    return "USER"
}

func getTextGeneric(element: AXUIElement, depth: Int) -> String {
    if depth > 120 { return "" }

    var output = ""

    // Get the text value
    var value: AnyObject?
    AXUIElementCopyAttributeValue(element, kAXValueAttribute as CFString, &value)
    let strValue = value as? String ?? ""

    if !strValue.isEmpty {
        let trimmed = strValue.trimmingCharacters(in: .whitespacesAndNewlines)

        // Filter out noise
        if trimmed.count < 2 {
            // Skip very short text (usually punctuation artifacts)
        } else if uiLiteralsGeneric.contains(trimmed) {
            // Skip known UI literals
        } else if trimmed.hasSuffix(" - Claude") {
            // Skip browser tab title (format: "Chat Title - Claude")
        } else {
            let semanticRole = getSemanticRoleForGeneric(element: element)

            switch semanticRole {
            case "NOISE":
                break
            case "CHAT_TITLE":
                output += "[CHAT_TITLE] \(trimmed)\n"
            case "METADATA":
                if isTimestamp(trimmed) {
                    output += "[METADATA] \(trimmed)\n"
                }
            case "TITLE":
                output += "[TITLE] \(trimmed)\n"
            case "ASSISTANT":
                output += "[ASSISTANT] \(trimmed)\n"
            case "USER":
                output += "[USER] \(trimmed)\n"
            default:
                output += "[\(semanticRole)] \(trimmed)\n"
            }
        }
    }

    // Recurse into children
    var children: AnyObject?
    AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &children)

    if let childrenArray = children as? [AXUIElement] {
        for child in childrenArray {
            output += getTextGeneric(element: child, depth: depth + 1)
        }
    }

    return output
}
