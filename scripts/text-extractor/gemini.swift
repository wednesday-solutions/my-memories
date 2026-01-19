import Cocoa
import ApplicationServices

let uiLiteralsGemini: Set<String> = [
    "Gemini", "History", "Recent", "Extensions", "Upload", "Sign in",
    "Privacy", "Terms", "Feedback",
    "Show thinking", "Hide thinking",
    "Gemini can make mistakes, so double-check it",
    "Gemini can make mistakes, so double-check it.",
    "Improve", "Reports", "Critique", "Write", "Focus",
    "My stuff", "Gems", "Writing editor", "Settings and help", "Chats",
    "Conversation with Gemini"
]

func isInListContainerForGemini(element: AXUIElement, maxDepth: Int) -> Bool {
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

func isInSelectedListItemForGemini(element: AXUIElement, maxDepth: Int) -> Bool {
    var current = element
    var depth = 0
    while depth < maxDepth {
        // Check AXSelected attribute
        var selectedValue: AnyObject?
        AXUIElementCopyAttributeValue(current, kAXSelectedAttribute as CFString, &selectedValue)
        if let selected = selectedValue as? Bool, selected == true {
            return true
        }

        // Check for "selected" in DOM class list (Gemini uses this)
        var classList: AnyObject?
        AXUIElementCopyAttributeValue(current, "AXDOMClassList" as CFString, &classList)
        if let classes = classList as? [String] {
            if classes.contains("selected") {
                return true
            }
        }

        var role: AnyObject?
        AXUIElementCopyAttributeValue(current, kAXRoleAttribute as CFString, &role)
        if let strRole = role as? String {
            if strRole == "AXList" || strRole == "AXOutline" || strRole == "AXTable" || strRole == "AXGrid" {
                return false
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

func isInToolbarContainerForGemini(element: AXUIElement, maxDepth: Int) -> Bool {
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
        if let desc = roleDesc as? String, desc.lowercased().contains("toolbar") {
            return true
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

func isGeminiChatHeader(element: AXUIElement) -> Bool {
    // Prefer AXHeading role outside of list containers
    var role: AnyObject?
    AXUIElementCopyAttributeValue(element, kAXRoleAttribute as CFString, &role)
    if let strRole = role as? String, strRole == "AXHeading" {
        if !isInListContainerForGemini(element: element, maxDepth: 12) {
            return true
        }
    }

    var roleDesc: AnyObject?
    AXUIElementCopyAttributeValue(element, kAXRoleDescriptionAttribute as CFString, &roleDesc)
    if let desc = roleDesc as? String, desc.lowercased().contains("heading") {
        if !isInListContainerForGemini(element: element, maxDepth: 12) {
            return true
        }
    }

    return false
}

func findAllListContainersForGemini(element: AXUIElement, depth: Int, results: inout [AXUIElement]) {
    if depth > 30 { return }
    var role: AnyObject?
    AXUIElementCopyAttributeValue(element, kAXRoleAttribute as CFString, &role)
    if let strRole = role as? String {
        if strRole == "AXList" || strRole == "AXOutline" || strRole == "AXTable" || strRole == "AXGrid" {
            results.append(element)
        }
    }

    var children: AnyObject?
    AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &children)
    if let childrenArray = children as? [AXUIElement] {
        for child in childrenArray {
            findAllListContainersForGemini(element: child, depth: depth + 1, results: &results)
        }
    }
}

func extractTextValueForGemini(from element: AXUIElement) -> String? {
    var value: AnyObject?
    AXUIElementCopyAttributeValue(element, kAXValueAttribute as CFString, &value)
    if let strValue = value as? String {
        let trimmed = strValue.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty && !uiLiteralsGemini.contains(trimmed) && !isLikelyURL(trimmed) {
            return trimmed
        }
    }

    var titleValue: AnyObject?
    AXUIElementCopyAttributeValue(element, kAXTitleAttribute as CFString, &titleValue)
    if let titleStr = titleValue as? String {
        let trimmed = titleStr.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty && !uiLiteralsGemini.contains(trimmed) && !isLikelyURL(trimmed) {
            return trimmed
        }
    }

    return nil
}

func extractTextFromElementTreeForGemini(_ element: AXUIElement, depth: Int, maxDepth: Int) -> String? {
    if depth > maxDepth { return nil }
    if let direct = extractTextValueForGemini(from: element) {
        return direct
    }

    var children: AnyObject?
    AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &children)
    if let childrenArray = children as? [AXUIElement] {
        for child in childrenArray {
            if let found = extractTextFromElementTreeForGemini(child, depth: depth + 1, maxDepth: maxDepth) {
                return found
            }
        }
    }
    return nil
}

func extractSelectedListItemTitle(root: AXUIElement) -> String? {
    var lists: [AXUIElement] = []
    findAllListContainersForGemini(element: root, depth: 0, results: &lists)
    for list in lists {
        var selectedChildren: AnyObject?
        AXUIElementCopyAttributeValue(list, kAXSelectedChildrenAttribute as CFString, &selectedChildren)
        if let selectedArray = selectedChildren as? [AXUIElement] {
            for child in selectedArray {
                if let text = extractTextFromElementTreeForGemini(child, depth: 0, maxDepth: 6) {
                    return text
                }
            }
        }

        var selectedRows: AnyObject?
        AXUIElementCopyAttributeValue(list, kAXSelectedRowsAttribute as CFString, &selectedRows)
        if let selectedRowsArray = selectedRows as? [AXUIElement] {
            for row in selectedRowsArray {
                if let text = extractTextFromElementTreeForGemini(row, depth: 0, maxDepth: 6) {
                    return text
                }
            }
        }
    }
    return nil
}

func getSemanticRoleForGemini(element: AXUIElement) -> String {
    var currentElement = element
    var depth = 0
    var hasAssistantClass = false
    var hasUserClass = false
    var isUIElement = false

    // Check the element's own role first
    var role: AnyObject?
    AXUIElementCopyAttributeValue(element, kAXRoleAttribute as CFString, &role)
    if let strRole = role as? String {
        if strRole == "AXButton" || strRole == "AXMenuItem" || strRole == "AXLink" || strRole == "AXTab" || strRole == "AXToolbar" {
            isUIElement = true
        }
    }

    while depth < 20 {
        var classList: AnyObject?
        AXUIElementCopyAttributeValue(currentElement, "AXDOMClassList" as CFString, &classList)

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
            if classes.contains(where: { $0.contains("model") || $0.contains("response") || $0.contains("assistant") || $0.contains("markdown") || $0.contains("prose") }) {
                hasAssistantClass = true
            }
            if classes.contains(where: { $0.contains("user") || $0.contains("query") || $0.contains("prompt") || $0.contains("request") }) {
                hasUserClass = true
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
    if hasAssistantClass {
        return "ASSISTANT"
    }
    if hasUserClass {
        return "USER"
    }

    // Fallback: treat as user content to preserve chat text if role markers are missing
    return "USER"
}

func getTextGemini(element: AXUIElement, depth: Int) -> String {
    if depth > 120 { return "" }

    var output = ""

    // Get the text value
    var value: AnyObject?
    AXUIElementCopyAttributeValue(element, kAXValueAttribute as CFString, &value)
    var strValue = value as? String ?? ""

    if strValue.isEmpty {
        var role: AnyObject?
        AXUIElementCopyAttributeValue(element, kAXRoleAttribute as CFString, &role)
        if let strRole = role as? String, strRole == "AXPopUpButton" || strRole == "AXButton" || strRole == "AXMenuButton" {
            var titleValue: AnyObject?
            AXUIElementCopyAttributeValue(element, kAXTitleAttribute as CFString, &titleValue)
            if let titleStr = titleValue as? String {
                strValue = titleStr
            }
        }
    }

    if !strValue.isEmpty {
        let trimmed = strValue.trimmingCharacters(in: .whitespacesAndNewlines)

        // Gemini top-bar chat title (button in toolbar)
        if isInToolbarContainerForGemini(element: element, maxDepth: 10) {
            if trimmed.count >= 2 && !uiLiteralsGemini.contains(trimmed) && !isLikelyURL(trimmed) {
                output += "[CHAT_TITLE] \(trimmed)\n"
            }
        }
        // Gemini main conversation header
        else if isGeminiChatHeader(element: element) {
            if trimmed.count >= 2 && !uiLiteralsGemini.contains(trimmed) {
                output += "[CHAT_TITLE] \(trimmed)\n"
            }
        }
        // Gemini sidebar selected chat title
        else if isInSelectedListItemForGemini(element: element, maxDepth: 12) {
            if trimmed.count >= 2 && !uiLiteralsGemini.contains(trimmed) {
                output += "[CHAT_TITLE] \(trimmed)\n"
            }
        } else {
            // Filter out noise
            if trimmed.count < 2 {
                // Skip very short text
            } else if uiLiteralsGemini.contains(trimmed) {
                // Skip known UI literals
            } else {
                let semanticRole = getSemanticRoleForGemini(element: element)

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
    }

    // Recurse into children
    var children: AnyObject?
    AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &children)

    if let childrenArray = children as? [AXUIElement] {
        for child in childrenArray {
            output += getTextGemini(element: child, depth: depth + 1)
        }
    }

    return output
}
