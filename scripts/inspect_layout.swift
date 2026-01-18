import Cocoa
import ApplicationServices

func getAttributes(element: AXUIElement) {
    var names: CFArray?
    AXUIElementCopyAttributeNames(element, &names)
    if let nameList = names as? [String] {
        print("Attributes for element:")
        for name in nameList {
            var value: AnyObject?
            let result = AXUIElementCopyAttributeValue(element, name as CFString, &value)
            
            if result == .success, let val = value {
                // Check if it's an AXValue (struct wrapper)
                if CFGetTypeID(val) == AXValueGetTypeID() {
                    let axVal = val as! AXValue
                    let type = AXValueGetType(axVal)
                    
                    if type == .cgPoint {
                        var point = CGPoint.zero
                        AXValueGetValue(axVal, type, &point)
                        print("  \(name): \(point)")
                    } else if type == .cgSize {
                        var size = CGSize.zero
                        AXValueGetValue(axVal, type, &size)
                        print("  \(name): \(size)")
                    } else if type == .cgRect {
                        var rect = CGRect.zero
                        AXValueGetValue(axVal, type, &rect)
                        print("  \(name): \(rect)")
                    } else {
                         // Some other AXValue type
                         print("  \(name): [AXValue \(type)]")
                    }
                } else {
                    // Regular object (String, Number, Array)
                    print("  \(name): \(val)")
                }
            } else {
                print("  \(name): <nil or error>")
            }
        }
    }
}

func inspect(element: AXUIElement, depth: Int, ancestry: [String]) {
    if depth > 20 { return }
    
    var role: AnyObject?
    AXUIElementCopyAttributeValue(element, kAXRoleAttribute as CFString, &role)
    let strRole = role as? String ?? "Unknown"
    
    var val: AnyObject?
    AXUIElementCopyAttributeValue(element, kAXValueAttribute as CFString, &val)
    let strVal = val as? String ?? ""

    var newAncestry = ancestry
    // Capture class list if available
    var classList: AnyObject?
    AXUIElementCopyAttributeValue(element, "AXDOMClassList" as CFString, &classList)
    
    let info = "[\(strRole)] Classes: \(classList ?? "[]" as AnyObject)"
    newAncestry.append(info)

    // Dump ALL text nodes to find the Timestamp structure
    if strRole == "AXStaticText" && !strVal.isEmpty {
        print("\n--- TEXT NODE FOUND ---")
        print("Value: \"\(strVal)\"")
        // Check ancestry
        for (i, ancestor) in newAncestry.reversed().enumerated() {
             print("  UP \(i): \(ancestor)")
             if i > 5 { break }
        }
    }

    // Children
    var children: AnyObject?
    AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &children)
    if let kids = children as? [AXUIElement] {
        for kid in kids {
            inspect(element: kid, depth: depth + 1, ancestry: newAncestry)
        }
    }
}

// Main
let args = CommandLine.arguments
if args.count < 2 { exit(1) }
let targetAppName = args[1]
let apps = NSWorkspace.shared.runningApplications
for app in apps {
    if let name = app.localizedName, name.lowercased().contains(targetAppName.lowercased()) {
        let pid = app.processIdentifier
        let appElem = AXUIElementCreateApplication(pid)
        var windows: AnyObject?
        AXUIElementCopyAttributeValue(appElem, kAXWindowsAttribute as CFString, &windows)
        if let windowList = windows as? [AXUIElement], let mainWin = windowList.first {
             print("Inspecting Window Structure...")
             inspect(element: mainWin, depth: 0, ancestry: [])
        }
        break
    }
}
