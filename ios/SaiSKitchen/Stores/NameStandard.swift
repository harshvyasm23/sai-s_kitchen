import SwiftUI

/// Turns messy customer names into the standard form: "Name Bhai Sai's Kitchen" (gents) / "Name Sai's Kitchen" (ladies).
enum NameStd {
    static let suffix = "Sai's Kitchen"
    static let maleWords: Set<String> = ["bhai", "bhaiya", "bhaiyya"]
    static let femaleWords: Set<String> = ["ben", "behen", "bhabhi", "lady", "ladies", "madam"]
    static let noise: Set<String> = Set(["sai", "s", "sais", "tiffin", "tifin", "tiffen", "tiffins", "tifins", "kitchen", "service", "ji", "gents"]).union(maleWords).union(femaleWords)
    static let placeFiller: Set<String> = ["iso", "at", "in", "railway", "station", "helsinki"]
    static let femaleNames: Set<String> = ["priti", "priya", "meena", "meenakshi", "pooja", "neha", "kavita", "anita", "sunita", "rekha", "divya", "jyoti",
        "sonal", "hetal", "nisha", "ritu", "aroona", "sneha", "shweta", "deepa", "dipti", "komal", "mina", "rina", "hema", "bhavna", "shilpa", "sapna"]
    static let short: [String: String] = ["omena": "Iso Omena", "pasila": "Pasila", "lepp": "Leppävaara", "myyr": "Myyrmäki", "station": "Helsinki"]

    private static func words(_ s: String) -> [String] {
        s.components(separatedBy: CharacterSet.letters.inverted).filter { !$0.isEmpty }
    }

    /// Words that identify the person, without "Bhai", "Sai's Kitchen", tiffin words. Used to match typed names.
    static func core(_ s: String) -> String {
        WhatsAppParser.norm(s).components(separatedBy: CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyz0123456789").inverted)
            .filter { !$0.isEmpty && !noise.contains($0) }.joined(separator: " ")
    }

    static func shortPlace(_ text: String) -> String {
        guard let p = WhatsAppParser.findPlace(text) else { return "" }
        return short[p.key] ?? ""
    }

    static func parse(_ old: String, address: String) -> (base: String, place: String, male: Bool) {
        var male: Bool? = nil
        var place = ""
        var keep: [String] = []
        for w in words(old) {
            let n = WhatsAppParser.norm(w)
            if maleWords.contains(n) { male = true }
            else if femaleWords.contains(n) { male = false }
            else if noise.contains(n) { continue }
            else {
                let p = n.count >= 4 ? shortPlace(n) : ""
                if !p.isEmpty && place.isEmpty { place = p } else if p.isEmpty { keep.append(w) }
            }
        }
        if !place.isEmpty { keep.removeAll { placeFiller.contains(WhatsAppParser.norm($0)) } }
        if place.isEmpty { place = shortPlace(address) }
        let base = keep.map { $0.lowercased().prefix(1).uppercased() + $0.lowercased().dropFirst() }.joined(separator: " ")
        if male == nil {
            let first = WhatsAppParser.norm(keep.first ?? "")
            male = !(femaleNames.contains(first) || first.hasSuffix("ben"))
        }
        return (base, place, male ?? true)
    }

    static func isSure(_ old: String) -> Bool {
        let w = words(old).map { WhatsAppParser.norm($0) }
        return w.contains { maleWords.contains($0) || femaleWords.contains($0) } || femaleNames.contains(w.first ?? "")
    }

    static func build(base: String, place: String, male: Bool) -> String {
        [base, place.trimmingCharacters(in: .whitespaces), male ? "Bhai" : "", suffix].filter { !$0.isEmpty }.joined(separator: " ")
    }
}

struct StandardizeNamesView: View {
    @Environment(KitchenStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var scheme
    private let theme = AppTheme()

    @State private var male: [String: Bool] = [:]
    @State private var place: [String: String] = [:]
    @State private var parsed: [String: (base: String, place: String, male: Bool)] = [:]
    @State private var ready = false
    @State private var done: Int? = nil

    private func needsPlace(_ c: Customer) -> Bool {
        guard let p = parsed[c.id] else { return false }
        let key = NameStd.core(p.base)
        return store.customers.filter { parsed[$0.id].map { NameStd.core($0.base) } == key }.count > 1
    }
    private func newName(_ c: Customer) -> String {
        guard let p = parsed[c.id] else { return c.name }
        return NameStd.build(base: p.base, place: needsPlace(c) ? (place[c.id] ?? "") : "", male: male[c.id] ?? true)
    }

    var body: some View {
        let customers = store.customers
        let names = customers.map { newName($0).lowercased() }
        let clash = Set(Dictionary(grouping: names, by: { $0 }).filter { $0.value.count > 1 }.keys)
        let missing = customers.filter { needsPlace($0) && (place[$0.id] ?? "").trimmingCharacters(in: .whitespaces).isEmpty }.count
        let changes = customers.filter { newName($0) != $0.name }.count
        NavigationStack {
            ZStack {
                theme.background(scheme).ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        if let n = done {
                            Text("Done \u{2713}  \(n) customer names updated.").font(.headline).padding(16).frame(maxWidth: .infinity, alignment: .leading).appCardStyle(scheme)
                            Button("Close") { dismiss() }.buttonStyle(.borderedProminent).tint(theme.primary)
                        } else {
                            Text("Gents become \"Name Bhai \(NameStd.suffix)\", ladies \"Name \(NameStd.suffix)\". If two different people have the same name, the place is added (Manish Kamppi, Manish Pasila). Check each line, then tap Apply.")
                                .font(.footnote).foregroundStyle(theme.secondaryText(scheme))
                            if !store.duplicateCustomerGroups().isEmpty {
                                Text("\u{26A0} Some customers are saved twice (same phone). Merge them first in Data Check, so the same person doesn't get two names.")
                                    .font(.footnote).padding(12).frame(maxWidth: .infinity, alignment: .leading).appCardStyle(scheme)
                            }
                            Button(changes == 0 ? "All names already standard \u{2713}" : "Apply to \(changes) customers") {
                                var n = 0
                                for c in customers {
                                    let nn = newName(c)
                                    if nn != c.name { var u = c; u.name = nn; store.updateCustomer(u); n += 1 }
                                }
                                done = n
                            }
                            .buttonStyle(.borderedProminent).tint(theme.primary)
                            .disabled(missing > 0 || !clash.isEmpty || changes == 0)
                            if missing > 0 { Text("\(missing) need a place (red below).").font(.footnote).foregroundStyle(.red) }
                            if !clash.isEmpty { Text("Two customers would get the same name. Add a place to tell them apart.").font(.footnote).foregroundStyle(.red) }
                            ForEach(customers) { c in
                                let need = needsPlace(c)
                                let bad = (need && (place[c.id] ?? "").trimmingCharacters(in: .whitespaces).isEmpty) || clash.contains(newName(c).lowercased())
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(c.name + (c.phone.isEmpty ? "" : "  \u{2022}  \(c.phone)")).font(.caption).foregroundStyle(theme.secondaryText(scheme))
                                    Text(newName(c)).font(.headline).foregroundStyle(bad ? Color.red : theme.primary)
                                    Picker("Gender", selection: Binding(get: { male[c.id] ?? true }, set: { male[c.id] = $0 })) {
                                        Text("Gents (Bhai)").tag(true)
                                        Text("Ladies").tag(false)
                                    }.pickerStyle(.segmented)
                                    if !NameStd.isSure(c.name) { Text("Not sure if gents or ladies - please check").font(.caption).foregroundStyle(.red) }
                                    if need {
                                        TextField("Place (same name as another customer)", text: Binding(get: { place[c.id] ?? "" }, set: { place[c.id] = $0 }))
                                            .textFieldStyle(.roundedBorder)
                                    }
                                }
                                .padding(14).frame(maxWidth: .infinity, alignment: .leading).appCardStyle(scheme)
                            }
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Standardize Names")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
            .onAppear {
                guard !ready else { return }
                for c in store.customers {
                    let p = NameStd.parse(c.name, address: c.address)
                    parsed[c.id] = p; male[c.id] = p.male; place[c.id] = p.place
                }
                ready = true
            }
        }
    }
}
