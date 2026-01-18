
import Cocoa
import ApplicationServices

func getText(element: AXUIElement, depth: Int) -> String {
    if depth > 10 { return "" }
    
    var output = ""
    
    // Check Value
    var value: AnyObject?
    AXUIElementCopyAttributeValue(element, kAXValueAttribute as CFString, &value)
    if let stringValue = value as? String, !stringValue.isEmpty {
        output += stringValue + "\n"
    }

    // Check Children
    var children: AnyObject?
    AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &children)
    
    if let childrenArray = children as? [AXUIElement] {
        for child in childrenArray {
            output += getText(element: child, depth: depth + 1)
        }
    }
    
    return output
}

let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
if !AXIsProcessTrustedWithOptions(options) {
    print("Accessibility permissions not granted")
    exit(1)
}

let apps = NSWorkspace.shared.runningApplications
for app in apps {
    if app.localizedName == "Claude" {
        let pid = app.processIdentifier
        let appElem = AXUIElementCreateApplication(pid)
        
        // Get Main Window
        var windows: AnyObject?
        AXUIElementCopyAttributeValue(appElem, kAXWindowsAttribute as CFString, &windows)
        
        if let windowList = windows as? [AXUIElement], let mainWin = windowList.first {
             print(getText(element: mainWin, depth: 0))
        }
        break
    }
}
