import Cocoa
import ApplicationServices

let uiLiteralsClaude: Set<String> = [
    "Claude", "Copy", "Retry", "Edit", "Reply...", "Opus 4.5", "Star",
    "Sonnet", "Send", "Cancel", "New chat", "Share", "Settings",
    "Copied!", "Regenerate", "Continue", "Stop generating",
    "Today", "Yesterday"
]

func isInToolbarContainerForClaude(element: AXUIElement, maxDepth: Int) -> Bool {
    var current = element
    var depth = 0
    while depth < maxDepth {
        var role: AnyObject?
        AXUIElementCopyAttributeValue(current, kAXRoleAttribute as CFString, &role)
        if let strRole = role as? String, strRole == "AXToolbar" {
            return true
        }

        var roleDesc: AnyObject?
        AXUIElementCopyAttributeValue(current, kAXRoleDescriptionAttribute as CFString, &roleDesc)
        if let desc = roleDesc as? String {
            let lower = desc.lowercased()
            if lower.contains("toolbar") || lower.contains("address") {
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

func isInSidebarContainerForClaude(element: AXUIElement, maxDepth: Int) -> Bool {
    var current = element
    var depth = 0
    while depth < maxDepth {
        var role: AnyObject?
        AXUIElementCopyAttributeValue(current, kAXRoleAttribute as CFString, &role)
        if let strRole = role as? String {
            if strRole == "AXSplitGroup" || strRole == "AXGroup" || strRole == "AXScrollArea" {
                var roleDesc: AnyObject?
                AXUIElementCopyAttributeValue(current, kAXRoleDescriptionAttribute as CFString, &roleDesc)
                if let desc = roleDesc as? String {
                    let lower = desc.lowercased()
                    if lower.contains("sidebar") || lower.contains("panel") {
                        return true
                    }
                }
            }
        }

        var classList: AnyObject?
        AXUIElementCopyAttributeValue(current, "AXDOMClassList" as CFString, &classList)
        if let classes = classList as? [String] {
            if classes.contains(where: { cls in
                let lower = cls.lowercased()
                return lower.contains("sidebar") ||
                       lower.contains("side-panel") ||
                       lower.contains("sidepanel") ||
                       lower.contains("right-panel") ||
                       lower.contains("rightpane") ||
                       lower.contains("right-pane") ||
                       lower.contains("artifact") ||
                       lower.contains("tools-panel")
            }) {
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

func getFrame(of element: AXUIElement) -> CGRect? {
    var frameValue: AnyObject?
    AXUIElementCopyAttributeValue(element, "AXFrame" as CFString, &frameValue)
    guard let rawValue = frameValue else { return nil }
    if CFGetTypeID(rawValue) == AXValueGetTypeID() {
        let axValue = rawValue as! AXValue
        var rect = CGRect.zero
        if AXValueGetValue(axValue, .cgRect, &rect) {
            return rect
        }
    }
    return nil
}

func getWindowFrame(from element: AXUIElement, maxDepth: Int) -> CGRect? {
    var current = element
    var depth = 0
    while depth < maxDepth {
        var role: AnyObject?
        AXUIElementCopyAttributeValue(current, kAXRoleAttribute as CFString, &role)
        if let strRole = role as? String, strRole == "AXWindow" {
            return getFrame(of: current)
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
    return nil
}

func isInRightPanelForClaude(element: AXUIElement) -> Bool {
    guard let elementFrame = getFrame(of: element) else { return false }
    guard let windowFrame = getWindowFrame(from: element, maxDepth: 12) else { return false }

    let windowRightStart = windowFrame.origin.x + windowFrame.size.width * 0.65
    let isRightSide = elementFrame.origin.x >= windowRightStart
    let isNarrow = elementFrame.size.width <= windowFrame.size.width * 0.45
    return isRightSide && isNarrow
}

func isClaudeWebNonChatElement(element: AXUIElement, maxDepth: Int) -> Bool {
    var current = element
    var depth = 0
    while depth < maxDepth {
        var roleDesc: AnyObject?
        AXUIElementCopyAttributeValue(current, kAXRoleDescriptionAttribute as CFString, &roleDesc)
        if let desc = roleDesc as? String {
            let lower = desc.lowercased()
            if lower.contains("sidebar") || lower.contains("panel") || lower.contains("toolbar") || lower.contains("menu") || lower.contains("popover") || lower.contains("dialog") || lower.contains("drawer") {
                return true
            }
        }

        var subrole: AnyObject?
        AXUIElementCopyAttributeValue(current, kAXSubroleAttribute as CFString, &subrole)
        if let sub = subrole as? String {
            let lower = sub.lowercased()
            if lower.contains("dialog") || lower.contains("popover") || lower.contains("menu") {
                return true
            }
        }

        var classList: AnyObject?
        AXUIElementCopyAttributeValue(current, "AXDOMClassList" as CFString, &classList)
        if let classes = classList as? [String] {
            if classes.contains(where: { cls in
                let lower = cls.lowercased()
                return lower.contains("sidebar") ||
                       lower.contains("side-panel") ||
                       lower.contains("sidepanel") ||
                       lower.contains("right-panel") ||
                       lower.contains("rightpane") ||
                       lower.contains("right-pane") ||
                       lower.contains("artifact") ||
                       lower.contains("tools") ||
                       lower.contains("tool") ||
                       lower.contains("critique") ||
                       lower.contains("report") ||
                       lower.contains("improve") ||
                       lower.contains("feedback") ||
                       lower.contains("analysis") ||
                       lower.contains("drawer") ||
                       lower.contains("popover") ||
                       lower.contains("menu") ||
                       lower.contains("prowritingaid") ||
                       lower.contains("pwa-")
            }) {
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

func isAXElementVisible(_ element: AXUIElement) -> Bool {
    var visibleValue: AnyObject?
    AXUIElementCopyAttributeValue(element, "AXVisible" as CFString, &visibleValue)
    if let visible = visibleValue as? Bool, visible == false {
        return false
    }

    var hiddenValue: AnyObject?
    AXUIElementCopyAttributeValue(element, "AXHidden" as CFString, &hiddenValue)
    if let hidden = hiddenValue as? Bool, hidden == true {
        return false
    }

    if let frame = getFrame(of: element) {
        if frame.size.width <= 1 || frame.size.height <= 1 {
            return false
        }
    }

    return true
}

func getSemanticRoleForClaudeWeb(element: AXUIElement) -> String {
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
        if strRole == "AXButton" || strRole == "AXMenuItem" || strRole == "AXTextField" || strRole == "AXComboBox" || strRole == "AXSearchField" || strRole == "AXMenuButton" || strRole == "AXPopUpButton" || strRole == "AXToolbar" || strRole == "AXTabGroup" {
            isUIElement = true
        }
        if strRole == "AXHeading" {
            isHeader = true
        }
    }

    // Address bar / toolbar noise (browser chrome)
    if isInToolbarContainerForClaude(element: element, maxDepth: 8) {
        isUIElement = true
    }

    // Right sidebar/tool panels (Improve/Reports/etc.)
    if isInSidebarContainerForClaude(element: element, maxDepth: 10) || isInRightPanelForClaude(element: element) || isClaudeWebNonChatElement(element: element, maxDepth: 10) {
        isUIElement = true
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
                    classes.contains("font-claude-response-body") ||
                    classes.contains(where: { $0.contains("assistant") || $0.contains("response") || $0.contains("markdown") || $0.contains("prose") }) {
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

func getSemanticRoleForClaudeDesktop(element: AXUIElement) -> String {
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
               classes.contains("font-claude-response-body") ||
               classes.contains(where: { $0.contains("assistant") || $0.contains("response") || $0.contains("markdown") || $0.contains("prose") }) {
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

func getTextClaudeWeb(element: AXUIElement, depth: Int) -> String {
    if depth > 120 { return "" }

    var output = ""

    // Get the text value
    var value: AnyObject?
    AXUIElementCopyAttributeValue(element, kAXValueAttribute as CFString, &value)
    let strValue = value as? String ?? ""

    if !strValue.isEmpty {
        let trimmed = strValue.trimmingCharacters(in: .whitespacesAndNewlines)

        // Filter out noise
        if !isAXElementVisible(element) {
            // Skip hidden/offscreen elements
        } else if isInToolbarContainerForClaude(element: element, maxDepth: 8) || isInSidebarContainerForClaude(element: element, maxDepth: 10) || isInRightPanelForClaude(element: element) || isClaudeWebNonChatElement(element: element, maxDepth: 10) {
            // Skip browser chrome and non-chat panels
        } else if trimmed.count < 2 {
            // Skip very short text (usually punctuation artifacts)
        } else if uiLiteralsClaude.contains(trimmed) {
            // Skip known UI literals
        } else if trimmed.hasSuffix(" - Claude") {
            // Skip browser tab title (format: "Chat Title - Claude")
        } else {
            let semanticRole = getSemanticRoleForClaudeWeb(element: element)

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
            output += getTextClaudeWeb(element: child, depth: depth + 1)
        }
    }

    return output
}

func getTextClaudeDesktop(element: AXUIElement, depth: Int) -> String {
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
        } else if uiLiteralsClaude.contains(trimmed) {
            // Skip known UI literals
        } else if trimmed.hasSuffix(" - Claude") {
            // Skip browser tab title (format: "Chat Title - Claude")
        } else {
            let semanticRole = getSemanticRoleForClaudeDesktop(element: element)

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
            output += getTextClaudeDesktop(element: child, depth: depth + 1)
        }
    }

    return output
}
