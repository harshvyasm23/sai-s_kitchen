import SwiftUI

struct AppTheme {
    let primary = Color(hex: 0xFF6B35)
    let primaryDark = Color(hex: 0xE85A2A)
    let secondary = Color(hex: 0xF7931E)
    let success = Color(hex: 0x10B981)
    let warning = Color(hex: 0xF59E0B)
    let error = Color(hex: 0xEF4444)
    let info = Color(hex: 0x3B82F6)

    func background(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(hex: 0x0F1419) : Color(hex: 0xFFF8F0)
    }

    func secondaryBackground(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(hex: 0x1A1F29) : Color(hex: 0xFFF3E6)
    }

    func surface(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(hex: 0x1A1F29) : .white
    }

    func elevatedSurface(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(hex: 0x242B38) : .white
    }

    func text(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(hex: 0xF9FAFB) : Color(hex: 0x2D3142)
    }

    func secondaryText(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(hex: 0x9CA3AF) : Color(hex: 0x6B7280)
    }

    func border(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(hex: 0x374151) : Color(hex: 0xE5E7EB)
    }
}

extension Color {
    init(hex: UInt32, alpha: Double = 1) {
        let red = Double((hex >> 16) & 0xFF) / 255
        let green = Double((hex >> 8) & 0xFF) / 255
        let blue = Double(hex & 0xFF) / 255
        self.init(.sRGB, red: red, green: green, blue: blue, opacity: alpha)
    }
}

extension View {
    func appCardStyle(_ scheme: ColorScheme) -> some View {
        self
            .background(AppTheme().surface(scheme))
            .clipShape(.rect(cornerRadius: 16))
            .shadow(color: .black.opacity(scheme == .dark ? 0.28 : 0.08), radius: 10, x: 0, y: 4)
    }
}
