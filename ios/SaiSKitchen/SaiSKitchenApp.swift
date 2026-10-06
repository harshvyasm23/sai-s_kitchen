//
//  SaiSKitchenApp.swift
//  SaiSKitchen
//
//  Created by Rork on June 24, 2026.
//

import SwiftUI

@main
struct SaiSKitchenApp: App {
    @State private var store = KitchenStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(store)
        }
    }
}
