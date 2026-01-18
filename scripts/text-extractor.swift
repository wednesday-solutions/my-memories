import Cocoa
import ApplicationServices

/// Walks up the DOM ancestry to determine the semantic role of a text element
/// Returns: "ASSISTANT", "USER", "METADATA", "CHAT_TITLE", or "NOISE"
func getSemanticRole(element: AXUIElement) -> String {
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

/// Known UI literals that should be filtered out
let uiLiterals: Set<String> = [
    "Claude", "Copy", "Retry", "Edit", "Reply...", "Opus 4.5", "Star",
    "Sonnet", "Send", "Cancel", "New chat", "Share", "Settings",
    "Copied!", "Regenerate", "Continue", "Stop generating",
    "Today", "Yesterday"  // Date headers only
]

/// Check if text looks like a timestamp
func isTimestamp(_ text: String) -> Bool {
    let pattern = "^\\d{1,2}:\\d{2}\\s?(AM|PM)?$"
    return text.range(of: pattern, options: .regularExpression) != nil
}

/// Recursively extracts text from the accessibility tree with semantic role tagging
func getText(element: AXUIElement, depth: Int) -> String {
    if depth > 50 { return "" }
    
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
        
        // Get windows
        var windows: AnyObject?
        AXUIElementCopyAttributeValue(appElem, kAXWindowsAttribute as CFString, &windows)
        
        if let windowList = windows as? [AXUIElement], let mainWin = windowList.first {
            // Extract window title first
            var winTitle: AnyObject?
            AXUIElementCopyAttributeValue(mainWin, kAXTitleAttribute as CFString, &winTitle)
            if let title = winTitle as? String, !title.isEmpty {
                print("[WINDOW_TITLE] \(title)")
            }
            
            // Extract all text content with role tagging
            print(getText(element: mainWin, depth: 0))
        }
        break
    }
}
