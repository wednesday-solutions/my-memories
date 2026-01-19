import Cocoa
import ApplicationServices

enum CaptureMode {
    case claudeDesktop
    case claudeWeb
    case chatgpt
    case gemini
    case generic
}

var captureMode: CaptureMode = .generic

/// Walks up the DOM ancestry to determine the semantic role of a text element
/// Returns: "ASSISTANT", "USER", "METADATA", "CHAT_TITLE", or "NOISE"
func getSemanticRole(element: AXUIElement) -> String {
    switch captureMode {
    case .chatgpt:
        return getSemanticRoleForChatGPT(element: element)
    case .gemini:
        return getSemanticRoleForGemini(element: element)
    case .claudeDesktop, .claudeWeb:
        return getSemanticRoleForClaude(element: element)
    case .generic:
        return getSemanticRoleForClaude(element: element)
    }
}

func getSemanticRoleForClaude(element: AXUIElement) -> String {
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

/// Check if element is inside a navigation/sidebar area (for ChatGPT)
func isInNavigationArea(element: AXUIElement, maxDepth: Int) -> Bool {
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

func getSemanticRoleForChatGPT(element: AXUIElement) -> String {
    var currentElement = element
    var depth = 0
    var hasAssistantClass = false
    var hasUserClass = false
    var isUIElement = false
    
    // CHECK: If element is in navigation/sidebar area, it's noise
    if isInNavigationArea(element: element, maxDepth: 15) {
        return "NOISE"
    }
    
    // CHECK: If element is in a list container (sidebar chat list), it's noise
    if isInListContainer(element: element, maxDepth: 15) {
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
            if classes.contains(where: { $0.contains("markdown") || $0.contains("prose") || $0.contains("assistant") || $0.contains("response") || $0.contains("result") }) {
                hasAssistantClass = true
            }
            if classes.contains(where: { $0.contains("user") || $0.contains("prompt") || $0.contains("request") || $0.contains("whitespace-pre-wrap") || $0.contains("text-base") }) {
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

/// Known UI literals that should be filtered out
let uiLiterals: Set<String> = [
    "Claude", "Copy", "Retry", "Edit", "Reply...", "Opus 4.5", "Star",
    "Sonnet", "Send", "Cancel", "New chat", "Share", "Settings",
    "Copied!", "Regenerate", "Continue", "Stop generating",
    "Today", "Yesterday",  // Date headers only
    // ChatGPT UI
    "ChatGPT", "Chat history", "Search chats", "Images", "Apps", "Projects",
    "GPTs", "Explore GPTs", "Your chats", "Upgrade", "Log out", "Logout",
    "Skip to content", "Help", "Account", "Plans", "Billing",
    // Gemini UI
    "Gemini", "History", "Recent", "Extensions", "Upload", "Sign in",
    "Privacy", "Terms", "Feedback",
    "Show thinking", "Hide thinking",
    "Gemini can make mistakes, so double-check it",
    "Gemini can make mistakes, so double-check it.",
    "Improve", "Reports", "Critique", "Write", "Focus",
    "My stuff", "Gems", "Writing editor", "Settings and help", "Chats",
    "Conversation with Gemini"
]

/// Check if text looks like a timestamp
func isTimestamp(_ text: String) -> Bool {
    let pattern = "^\\d{1,2}:\\d{2}\\s?(AM|PM)?$"
    return text.range(of: pattern, options: .regularExpression) != nil
}

/// Recursively extracts text from the accessibility tree with semantic role tagging
func getText(element: AXUIElement, depth: Int) -> String {
    if depth > 120 { return "" }
    
    var output = ""
    
    // Get the text value
    var value: AnyObject?
    AXUIElementCopyAttributeValue(element, kAXValueAttribute as CFString, &value)
    var strValue = value as? String ?? ""

    if strValue.isEmpty && captureMode == .gemini {
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
        if captureMode == .gemini && isInToolbarContainer(element: element, maxDepth: 10) {
            if trimmed.count >= 2 && !uiLiterals.contains(trimmed) && !isLikelyURL(trimmed) {
                output += "[CHAT_TITLE] \(trimmed)\n"
            }
        }
        // Gemini main conversation header
        else if captureMode == .gemini && isGeminiChatHeader(element: element) {
            if trimmed.count >= 2 && !uiLiterals.contains(trimmed) {
                output += "[CHAT_TITLE] \(trimmed)\n"
            }
        }
        // Gemini sidebar selected chat title
        else if captureMode == .gemini && isInSelectedListItem(element: element, maxDepth: 12) {
            if trimmed.count >= 2 && !uiLiterals.contains(trimmed) {
                output += "[CHAT_TITLE] \(trimmed)\n"
            }
        } else {
            // Filter out noise
            if trimmed.count < 2 {
                // Skip very short text (usually punctuation artifacts)
            } else if uiLiterals.contains(trimmed) {
                // Skip known UI literals
            } else if trimmed.hasSuffix(" - Claude") {
                // Skip browser tab title (format: "Chat Title - Claude")
            } else {
                let semanticRole = getSemanticRole(element: element)
                
                switch semanticRole {
                case "NOISE":
                    // Skip UI elements
                    break
                case "CHAT_TITLE":
                    output += "[CHAT_TITLE] \(trimmed)\n"
                case "METADATA":
                    // Only include if it looks like a timestamp
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
            output += getText(element: child, depth: depth + 1)
        }
    }
    
    return output
}

/// Find the first scroll area in the accessibility tree
func findScrollArea(element: AXUIElement, depth: Int) -> AXUIElement? {
    if depth > 30 { return nil }
    var role: AnyObject?
    AXUIElementCopyAttributeValue(element, kAXRoleAttribute as CFString, &role)
    if let strRole = role as? String, strRole == "AXScrollArea" {
        return element
    }

    var children: AnyObject?
    AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &children)
    if let childrenArray = children as? [AXUIElement] {
        for child in childrenArray {
            if let found = findScrollArea(element: child, depth: depth + 1) {
                return found
            }
        }
    }
    return nil
}

/// Collect all scroll areas in the accessibility tree
func findAllScrollAreas(element: AXUIElement, depth: Int, results: inout [AXUIElement]) {
    if depth > 30 { return }
    var role: AnyObject?
    AXUIElementCopyAttributeValue(element, kAXRoleAttribute as CFString, &role)
    if let strRole = role as? String, strRole == "AXScrollArea" {
        results.append(element)
    }

    var children: AnyObject?
    AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &children)
    if let childrenArray = children as? [AXUIElement] {
        for child in childrenArray {
            findAllScrollAreas(element: child, depth: depth + 1, results: &results)
        }
    }
}

func findAllListContainers(element: AXUIElement, depth: Int, results: inout [AXUIElement]) {
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
            findAllListContainers(element: child, depth: depth + 1, results: &results)
        }
    }
}

func extractTextValue(from element: AXUIElement) -> String? {
    var value: AnyObject?
    AXUIElementCopyAttributeValue(element, kAXValueAttribute as CFString, &value)
    if let strValue = value as? String {
        let trimmed = strValue.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty && !uiLiterals.contains(trimmed) && !isLikelyURL(trimmed) {
            return trimmed
        }
    }

    var titleValue: AnyObject?
    AXUIElementCopyAttributeValue(element, kAXTitleAttribute as CFString, &titleValue)
    if let titleStr = titleValue as? String {
        let trimmed = titleStr.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty && !uiLiterals.contains(trimmed) && !isLikelyURL(trimmed) {
            return trimmed
        }
    }

    return nil
}

func extractTextFromElementTree(_ element: AXUIElement, depth: Int, maxDepth: Int) -> String? {
    if depth > maxDepth { return nil }
    if let direct = extractTextValue(from: element) {
        return direct
    }

    var children: AnyObject?
    AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &children)
    if let childrenArray = children as? [AXUIElement] {
        for child in childrenArray {
            if let found = extractTextFromElementTree(child, depth: depth + 1, maxDepth: maxDepth) {
                return found
            }
        }
    }
    return nil
}

func extractSelectedListItemTitle(root: AXUIElement) -> String? {
    var lists: [AXUIElement] = []
    findAllListContainers(element: root, depth: 0, results: &lists)
    for list in lists {
        var selectedChildren: AnyObject?
        AXUIElementCopyAttributeValue(list, kAXSelectedChildrenAttribute as CFString, &selectedChildren)
        if let selectedArray = selectedChildren as? [AXUIElement] {
            for child in selectedArray {
                if let text = extractTextFromElementTree(child, depth: 0, maxDepth: 6) {
                    return text
                }
            }
        }

        var selectedRows: AnyObject?
        AXUIElementCopyAttributeValue(list, kAXSelectedRowsAttribute as CFString, &selectedRows)
        if let selectedRowsArray = selectedRows as? [AXUIElement] {
            for row in selectedRowsArray {
                if let text = extractTextFromElementTree(row, depth: 0, maxDepth: 6) {
                    return text
                }
            }
        }
    }
    return nil
}

func selectPrimaryScrollArea(from areas: [AXUIElement]) -> AXUIElement? {
    if areas.isEmpty { return nil }
    var best: AXUIElement? = nil
    var bestScore = -1

    for area in areas {
        let lines = collectLines(from: area)
        var score = 0
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty { continue }
            let clean = trimmed.replacingOccurrences(of: "^\\[.*?\\]", with: "", options: .regularExpression)
            if clean.isEmpty { continue }
            if uiLiterals.contains(clean) { continue }
            score += 1
        }
        if score > bestScore {
            bestScore = score
            best = area
        }
    }

    return best
}

func isInListContainer(element: AXUIElement, maxDepth: Int) -> Bool {
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

func isInSelectedListItem(element: AXUIElement, maxDepth: Int) -> Bool {
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

func isInToolbarContainer(element: AXUIElement, maxDepth: Int) -> Bool {
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
        if !isInListContainer(element: element, maxDepth: 12) {
            return true
        }
    }

    var roleDesc: AnyObject?
    AXUIElementCopyAttributeValue(element, kAXRoleDescriptionAttribute as CFString, &roleDesc)
    if let desc = roleDesc as? String, desc.lowercased().contains("heading") {
        if !isInListContainer(element: element, maxDepth: 12) {
            return true
        }
    }

    return false
}

func getVerticalScrollBar(from scrollArea: AXUIElement) -> AXUIElement? {
    var bar: AnyObject?
    AXUIElementCopyAttributeValue(scrollArea, kAXVerticalScrollBarAttribute as CFString, &bar)
    if let barElem = bar, CFGetTypeID(barElem) == AXUIElementGetTypeID() {
        return (barElem as! AXUIElement)
    }
    return nil
}

func getScrollRange(scrollBar: AXUIElement) -> (Double, Double)? {
    var minVal: AnyObject?
    var maxVal: AnyObject?
    AXUIElementCopyAttributeValue(scrollBar, kAXMinValueAttribute as CFString, &minVal)
    AXUIElementCopyAttributeValue(scrollBar, kAXMaxValueAttribute as CFString, &maxVal)

    let minNum = minVal as? NSNumber
    let maxNum = maxVal as? NSNumber
    if let min = minNum?.doubleValue, let max = maxNum?.doubleValue {
        return (min, max)
    }
    return nil
}

/// Check if text looks like a URL or domain
func isLikelyURL(_ text: String) -> Bool {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty { return false }
    if trimmed.count < 4 || trimmed.count > 2048 { return false }
    if trimmed.contains(" ") { return false }

    let lower = trimmed.lowercased()
    if lower.contains("claude.ai") { return true }
    if lower.contains("chatgpt.com") { return true }
    if lower.contains("chat.openai.com") { return true }
    if lower.contains("gemini.google.com") { return true }
    if lower.contains("bard.google.com") { return true }
    if lower.hasPrefix("http://") || lower.hasPrefix("https://") { return true }

    let pattern = "^[a-z0-9.-]+\\.[a-z]{2,}(/[^\\s]*)?$"
    return lower.range(of: pattern, options: .regularExpression) != nil
}

func isClaudeURL(_ text: String) -> Bool {
    let lower = text.lowercased()
    return lower.contains("claude.ai")
}

func isGeminiURL(_ text: String) -> Bool {
    let lower = text.lowercased()
    return lower.contains("gemini.google.com") || lower.contains("bard.google.com")
}

func isChatGPTURL(_ text: String) -> Bool {
    let lower = text.lowercased()
    return lower.contains("chatgpt.com") || lower.contains("chat.openai.com")
}

/// Try to extract a URL-like string from an element
func urlCandidate(from element: AXUIElement) -> String? {
    var value: AnyObject?
    AXUIElementCopyAttributeValue(element, kAXValueAttribute as CFString, &value)
    if let strValue = value as? String {
        let trimmed = strValue.trimmingCharacters(in: .whitespacesAndNewlines)
        if isLikelyURL(trimmed) {
            return trimmed
        }
    }
    return nil
}

/// Find a browser URL in the accessibility tree, preferring claude.ai or chatgpt.com if present
func findBrowserURL(element: AXUIElement, depth: Int, fallback: inout String?) -> String? {
    if depth > 40 { return nil }

    if let candidate = urlCandidate(from: element) {
        let lower = candidate.lowercased()
        if lower.contains("claude.ai") || lower.contains("chatgpt.com") || lower.contains("chat.openai.com") || lower.contains("gemini.google.com") || lower.contains("bard.google.com") {
            return candidate
        }
        if fallback == nil {
            fallback = candidate
        }
    }

    var children: AnyObject?
    AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &children)
    if let childrenArray = children as? [AXUIElement] {
        for child in childrenArray {
            if let found = findBrowserURL(element: child, depth: depth + 1, fallback: &fallback) {
                return found
            }
        }
    }
    return nil
}

func setScrollValue(scrollBar: AXUIElement, value: Double) {
    let num = NSNumber(value: value)
    AXUIElementSetAttributeValue(scrollBar, kAXValueAttribute as CFString, num)
}

func collectLines(from element: AXUIElement) -> [String] {
    let text = getText(element: element, depth: 0)
    if text.isEmpty { return [] }
    return text.split(separator: "\n").map { String($0) }
}

// === MAIN ===
let args = CommandLine.arguments
if args.count < 2 { 
    print("Usage: text-extractor <app-name>")
    exit(1) 
}

let targetAppName = args[1]

// Check accessibility permissions
let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
if !AXIsProcessTrustedWithOptions(options) { 
    print("Accessibility permissions not granted")
    exit(1) 
}

let apps = NSWorkspace.shared.runningApplications
for app in apps {
    if let name = app.localizedName, name.lowercased().contains(targetAppName.lowercased()) {
        let pid = app.processIdentifier
        let appElem = AXUIElementCreateApplication(pid)
        
        // Prefer focused window if available (better for long chats)
        var focusedWin: AnyObject?
        AXUIElementCopyAttributeValue(appElem, kAXFocusedWindowAttribute as CFString, &focusedWin)

        var targetWindow: AXUIElement? = nil
        if let focused = focusedWin, CFGetTypeID(focused) == AXUIElementGetTypeID() {
            targetWindow = (focused as! AXUIElement)
        } else {
            // Fallback to first window
            var windows: AnyObject?
            AXUIElementCopyAttributeValue(appElem, kAXWindowsAttribute as CFString, &windows)
            if let windowList = windows as? [AXUIElement], let mainWin = windowList.first {
                targetWindow = mainWin
            }
        }

        if let mainWin = targetWindow {
            // Extract window title first
            var winTitle: AnyObject?
            AXUIElementCopyAttributeValue(mainWin, kAXTitleAttribute as CFString, &winTitle)
            if let title = winTitle as? String, !title.isEmpty {
                print("[WINDOW_TITLE] \(title)")
            }

            // Attempt to extract browser URL (if present)
            var urlFallback: String? = nil
            var detectedURL: String? = nil
            if let url = findBrowserURL(element: mainWin, depth: 0, fallback: &urlFallback) {
                detectedURL = url
                print("[BROWSER_URL] \(url)")
            } else if let urlFallback = urlFallback {
                detectedURL = urlFallback
                print("[BROWSER_URL] \(urlFallback)")
            }

            // Set capture mode based on app + URL
            if targetAppName.lowercased().contains("claude") {
                captureMode = .claudeDesktop
            } else if let url = detectedURL {
                if isClaudeURL(url) {
                    captureMode = .claudeWeb
                } else if isChatGPTURL(url) {
                    captureMode = .chatgpt
                } else if isGeminiURL(url) {
                    captureMode = .gemini
                } else {
                    captureMode = .generic
                }
            } else {
                captureMode = .generic
            }

            if captureMode == .gemini {
                if let sidebarTitle = extractSelectedListItemTitle(root: mainWin) {
                    print("[CHAT_TITLE] \(sidebarTitle)")
                }
            }

            // Attempt multi-pass scrolling extraction for long chats
            var extractionRoot: AXUIElement = mainWin
            if captureMode == .chatgpt || captureMode == .gemini {
                var areas: [AXUIElement] = []
                findAllScrollAreas(element: mainWin, depth: 0, results: &areas)
                if let best = selectPrimaryScrollArea(from: areas) {
                    extractionRoot = best
                }
            }

            let scrollArea: AXUIElement? = {
                var role: AnyObject?
                AXUIElementCopyAttributeValue(extractionRoot, kAXRoleAttribute as CFString, &role)
                if let strRole = role as? String, strRole == "AXScrollArea" {
                    return extractionRoot
                }
                return findScrollArea(element: extractionRoot, depth: 0)
            }()
            let scrollBar = scrollArea != nil ? getVerticalScrollBar(from: scrollArea!) : nil

            var allLines: [String] = []
            var recentSet: Set<String> = []
            var recentQueue: [String] = []
            let recentLimit = 800

            func appendLines(_ lines: [String]) {
                for line in lines {
                    if recentSet.contains(line) {
                        continue
                    }
                    allLines.append(line)
                    recentSet.insert(line)
                    recentQueue.append(line)
                    if recentQueue.count > recentLimit {
                        let removed = recentQueue.removeFirst()
                        recentSet.remove(removed)
                    }
                }
            }

            if let bar = scrollBar, let range = getScrollRange(scrollBar: bar) {
                let minVal = range.0
                let maxVal = range.1
                let steps = 50

                // Start at top
                setScrollValue(scrollBar: bar, value: minVal)
                usleep(200_000)
                appendLines(collectLines(from: extractionRoot))

                if maxVal > minVal {
                    for i in 1...steps {
                        let t = Double(i) / Double(steps)
                        let val = minVal + (maxVal - minVal) * t
                        setScrollValue(scrollBar: bar, value: val)
                        usleep(150_000)
                        appendLines(collectLines(from: extractionRoot))
                    }
                }
            } else {
                // Fallback: single pass
                appendLines(collectLines(from: extractionRoot))
            }

            if !allLines.isEmpty {
                print(allLines.joined(separator: "\n"))
            }
        }
        break
    }
}
