import Cocoa
import ApplicationServices

let uiLiteralsChatGPT: Set<String> = [
    "ChatGPT", "Chat history", "Search chats", "Images", "Apps", "Projects",
    "GPTs", "Explore GPTs", "Your chats", "Upgrade", "Log out", "Logout",
    "Skip to content", "Help", "Account", "Plans", "Billing",
    "ChatGPT can make mistakes. Check important info.",
    "ChatGPT can make mistakes. Check important info. See",
    "Check important info.",
    "See"
]

/// Check if element is inside a navigation/sidebar area (for ChatGPT)
func isInNavigationAreaForChatGPT(element: AXUIElement, maxDepth: Int) -> Bool {
    var current = element
    var depth = 0
    while depth < maxDepth {
        var role: AnyObject?
        AXUIElementCopyAttributeValue(current, kAXRoleAttribute as CFString, &role)
        if let strRole = role as? String {
            // Navigation elements
            if strRole == "AXNavigation" || strRole == "AXLandmarkNavigation" {
                return true
            }
        }

        // Check DOM classes for nav/sidebar indicators
        var classList: AnyObject?
        AXUIElementCopyAttributeValue(current, "AXDOMClassList" as CFString, &classList)
        if let classes = classList as? [String] {
            // ChatGPT uses these classes for sidebar
            if classes.contains(where: {
                $0.lowercased().contains("sidebar") ||
                $0.lowercased().contains("navigation") ||
                $0.lowercased().contains("nav-") ||
                $0.lowercased() == "nav" ||
                $0.lowercased().contains("history") ||
                $0.lowercased().contains("chat-list") ||
                $0.lowercased().contains("conversation-list")
            }) {
                return true
            }
        }

        // Check role description
        var roleDesc: AnyObject?
        AXUIElementCopyAttributeValue(current, kAXRoleDescriptionAttribute as CFString, &roleDesc)
        if let desc = roleDesc as? String {
            let lower = desc.lowercased()
            if lower.contains("navigation") {
                return true
            }
        }

        var parent: AnyObject?
        AXUIElementCopyAttributeValue(current, kAXParentAttribute as CFString, &parent)
        if let parentElem = parent, CFGetTypeID(parentElem) == AXUIElementGetTypeID() {
            current = parentElem as! AXUIElement
        } else {
            break
        }
        depth += 1
    }
    return false
}

func isInListContainerForChatGPT(element: AXUIElement, maxDepth: Int) -> Bool {
    var current = element
    var depth = 0
    while depth < maxDepth {
        var role: AnyObject?
        AXUIElementCopyAttributeValue(current, kAXRoleAttribute as CFString, &role)
        if let strRole = role as? String {
            if strRole == "AXList" || strRole == "AXOutline" || strRole == "AXTable" || strRole == "AXGrid" {
                return true
            }
        }
        var parent: AnyObject?
        AXUIElementCopyAttributeValue(current, kAXParentAttribute as CFString, &parent)
        if let parentElem = parent, CFGetTypeID(parentElem) == AXUIElementGetTypeID() {
            current = parentElem as! AXUIElement
        } else {
            break
        }
        depth += 1
    }
    return false
}

func getSemanticRoleForChatGPT(element: AXUIElement) -> String {
    var currentElement = element
    var depth = 0
    var hasAssistantClass = false
    var hasUserClass = false
    var isUIElement = false
    var domRoleOverride: String? = nil

    // CHECK: If element is in navigation/sidebar area, it's noise
    if isInNavigationAreaForChatGPT(element: element, maxDepth: 15) {
        return "NOISE"
    }

    // CHECK: If element is in a list container (sidebar chat list), it's noise
    if isInListContainerForChatGPT(element: element, maxDepth: 15) {
        return "NOISE"
    }

    // Check the element's own role first
    var role: AnyObject?
    AXUIElementCopyAttributeValue(element, kAXRoleAttribute as CFString, &role)
    if let strRole = role as? String {
        if strRole == "AXButton" || strRole == "AXMenuItem" || strRole == "AXLink" || strRole == "AXTab" || strRole == "AXToolbar" {
            isUIElement = true
        }
    }

    // Prefer explicit DOM attributes when available (data-message-author-role, aria-label, role)
    func applyDomRoleOverride(from element: AXUIElement) {
        if domRoleOverride != nil { return }
        var domAttributes: AnyObject?
        AXUIElementCopyAttributeValue(element, "AXDOMAttributes" as CFString, &domAttributes)
        if let attrs = domAttributes as? [String: Any] {
            if let authorRole = attrs["data-message-author-role"] as? String {
                let lower = authorRole.lowercased()
                if lower == "assistant" || lower == "user" {
                    domRoleOverride = lower.uppercased()
                }
            }
            if domRoleOverride == nil, let ariaLabel = attrs["aria-label"] as? String {
                let lower = ariaLabel.lowercased()
                if lower.contains("assistant") {
                    domRoleOverride = "ASSISTANT"
                } else if lower.contains("user") {
                    domRoleOverride = "USER"
                }
            }
            if domRoleOverride == nil, let domRole = attrs["role"] as? String {
                let lower = domRole.lowercased()
                if lower.contains("assistant") {
                    domRoleOverride = "ASSISTANT"
                } else if lower.contains("user") {
                    domRoleOverride = "USER"
                }
            }
        }
        if domRoleOverride == nil {
            var identifier: AnyObject?
            AXUIElementCopyAttributeValue(element, "AXIdentifier" as CFString, &identifier)
            if let idStr = identifier as? String {
                let lower = idStr.lowercased()
                if lower.contains("assistant") {
                    domRoleOverride = "ASSISTANT"
                } else if lower.contains("user") {
                    domRoleOverride = "USER"
                }
            }
        }
    }

    applyDomRoleOverride(from: element)

    while depth < 20 {
        var classList: AnyObject?
        AXUIElementCopyAttributeValue(currentElement, "AXDOMClassList" as CFString, &classList)
        applyDomRoleOverride(from: currentElement)

        var ancestorRole: AnyObject?
        AXUIElementCopyAttributeValue(currentElement, kAXRoleAttribute as CFString, &ancestorRole)
        if let r = ancestorRole as? String {
            if r == "AXList" || r == "AXOutline" || r == "AXTable" || r == "AXGrid" || r == "AXToolbar" || r == "AXTabGroup" || r == "AXTextArea" || r == "AXTextField" || r == "AXButton" || r == "AXMenuButton" || r == "AXPopUpButton" || r == "AXMenuItem" {
                isUIElement = true
            }
        }

        var roleDesc: AnyObject?
        AXUIElementCopyAttributeValue(currentElement, kAXRoleDescriptionAttribute as CFString, &roleDesc)
        if let desc = roleDesc as? String {
            let lower = desc.lowercased()
            if lower.contains("menu") || lower.contains("toolbar") || lower.contains("tab") {
                isUIElement = true
            }
        }

        if let classes = classList as? [String] {
            // Check for explicit user bubble class first (most reliable)
            if classes.contains(where: { $0 == "user-message-bubble-color" }) {
                hasUserClass = true
            }
            // Check for explicit assistant indicators
            if classes.contains(where: {
                $0 == "markdown" ||
                $0 == "prose" ||
                $0.hasPrefix("markdown-") ||
                $0.contains("agent-turn") ||
                $0.contains("assistant-message-bubble-color")
            }) {
                hasAssistantClass = true
            }
            // Fallback: generic user/assistant in class names
            if !hasUserClass && !hasAssistantClass {
                if classes.contains(where: { $0.contains("assistant") || $0.contains("response") || $0.contains("result") }) {
                    hasAssistantClass = true
                }
                if classes.contains(where: { $0.contains("user-message") || $0.contains("prompt") || $0.contains("request") }) {
                    hasUserClass = true
                }
            }

            if classes.contains("ProseMirror") || classes.contains("is-empty") || classes.contains("is-editor-empty") {
                isUIElement = true
            }
        }

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

    if isUIElement {
        return "NOISE"
    }
    if let override = domRoleOverride {
        return override
    }
    // User bubble class is most specific - takes priority
    if hasUserClass {
        return "USER"
    }
    if hasAssistantClass {
        return "ASSISTANT"
    }

    // Fallback: treat as user content to preserve chat text if role markers are missing
    return "USER"
}

func getTextChatGPT(element: AXUIElement, depth: Int) -> String {
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
            // Skip very short text
        } else if uiLiteralsChatGPT.contains(trimmed) {
            // Skip known UI literals
        } else {
            let semanticRole = getSemanticRoleForChatGPT(element: element)

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
            output += getTextChatGPT(element: child, depth: depth + 1)
        }
    }

    return output
}
