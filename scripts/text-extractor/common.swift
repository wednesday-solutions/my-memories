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

/// Check if text looks like a timestamp
func isTimestamp(_ text: String) -> Bool {
    let pattern = "^\\d{1,2}:\\d{2}\\s?(AM|PM)?$"
    return text.range(of: pattern, options: .regularExpression) != nil
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

/// Find a browser URL in the accessibility tree, preferring known domains if present
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

func setScrollValue(scrollBar: AXUIElement, value: Double) {
    let num = NSNumber(value: value)
    AXUIElementSetAttributeValue(scrollBar, kAXValueAttribute as CFString, num)
}
