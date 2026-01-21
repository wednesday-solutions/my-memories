import Cocoa
import ApplicationServices

// Model for JSON Output
struct WindowContext: Codable {
    let appName: String
    let title: String
    let selectedText: String
    let content: String
    let isTrusted: Bool
}

func getAttribute(element: AXUIElement, attribute: String) -> CFTypeRef? {
    var value: CFTypeRef?
    let result = AXUIElementCopyAttributeValue(element, attribute as CFString, &value)
    if result == .success {
        return value
    }
    return nil
}

func getFocusedElement() -> WindowContext? {
    let systemWide = AXUIElementCreateSystemWide()
    
    // Check trust
    if !AXIsProcessTrusted() {
        return WindowContext(appName: "Unknown", title: "Permission Denied", selectedText: "", content: "", isTrusted: false)
    }
    // print("DEBUG: Process trusted")

    // Get focused app
    var appElement: AXUIElement!
    var appName = "Unknown"

    // Try NSWorkspace first (more robust)
    if let frontApp = NSWorkspace.shared.frontmostApplication {
        appName = frontApp.localizedName ?? "Unknown"
        appElement = AXUIElementCreateApplication(frontApp.processIdentifier)
    } else {
        // Fallback to AXSystemWide
        guard let focusedApp = getAttribute(element: systemWide, attribute: kAXFocusedApplicationAttribute) else {
            return nil
        }
        appElement = (focusedApp as! AXUIElement)
    }
    
    // Get focused UI Element directly from the app element (more reliable than system-wide)
    guard let focusedElementRef = getAttribute(element: appElement, attribute: kAXFocusedUIElementAttribute) else {
        
        // Fallback: Try to get the focused window if specific element fails
        if let windowRef = getAttribute(element: appElement, attribute: kAXFocusedWindowAttribute) {
             // We can at least get the title from the window
             let window = windowRef as! AXUIElement
             var windowTitle = ""
             if let title = getAttribute(element: window, attribute: kAXTitleAttribute) as? String {
                windowTitle = title
             }
             // Return just the window info if we can't get the element
             return WindowContext(appName: appName, title: windowTitle, selectedText: "", content: "", isTrusted: true)
        }
        
        return nil
    }
    let focusedElement = focusedElementRef as! AXUIElement
    
    // Try to get Value (content) or Selected Text
    var selectedText = ""
    var content = ""

    if let selected = getAttribute(element: focusedElement, attribute: kAXSelectedTextAttribute) as? String {
        selectedText = selected
    }
    
    if let val = getAttribute(element: focusedElement, attribute: kAXValueAttribute) as? String {
        content = val
    }
    
    // Get Window Title
    var windowTitle = ""
    if let window = getAttribute(element: focusedElement, attribute: kAXWindowAttribute) {
        let windowElem = window as! AXUIElement
        if let title = getAttribute(element: windowElem, attribute: kAXTitleAttribute) as? String {
            windowTitle = title
        }
    }
    // print("DEBUG: Found context for \(appName)")

    return WindowContext(appName: appName, title: windowTitle, selectedText: selectedText, content: content, isTrusted: true)
}

// Main Loop
setbuf(stdout, nil) // Unbuffer stdout

let timer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { _ in
    if let context = getFocusedElement() {
        // Relaxed condition: Print if we have at least an app name
        if !context.appName.isEmpty {
            let encoder = JSONEncoder()
            if let data = try? encoder.encode(context), let json = String(data: data, encoding: .utf8) {
                print(json)
            }
        }
    } else {
        // Check permissions silently? 
        if !AXIsProcessTrusted() {
             print("{\"isTrusted\": false}")
        }
    }
}

RunLoop.main.run()
