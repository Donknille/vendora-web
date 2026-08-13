// The language lives in a cookie so the server can render <html lang> — see
// lib/prefs.ts. Re-exported here because most call sites reach for it via i18n.
export type { Language } from "@/lib/prefs";
import type { Language } from "@/lib/prefs";

const translations = {
  en: {
    dashboard: { overview: "Overview", dashboard: "Dashboard", revenue: "Revenue", expenses: "Expenses", netProfit: "Net Profit", monthlyPerformance: "Monthly Performance", openOrders: "Open Orders", paidOrders: "Paid Orders", markets: "Markets", allYears: "All", month: "Month" },
    orders: { title: "Orders", noOrders: "No orders yet", noOrdersSub: "Create your first order to start tracking sales", newOrder: "New Order", editOrder: "Edit Order", invoice: "Invoice", customer: "Customer", customerName: "Customer name", email: "Email (optional)", street: "Street + No.", zip: "ZIP", city: "City", country: "Country", streetPlaceholder: "123 Main St", zipPlaceholder: "12345", cityPlaceholder: "City", invoiceDateLabel: "Invoice Date", serviceDateLabel: "Service Date", shippingCostLabel: "Shipping", posLabel: "Pos.", items: "Items", itemName: "Item name", qty: "Qty", price: "Price", notes: "Notes", additionalNotes: "Additional notes (optional)", total: "Total", createOrder: "Create Order", orderDetails: "Order Details", updateStatus: "Update Status", deleteOrder: "Delete Order", deleteConfirm: "Are you sure you want to delete this order?", deleteCancel: "Cancel", deleteAction: "Delete", changeStatus: "Change Status", changeStatusConfirm: "Set order to", confirm: "Confirm", missingInfo: "Missing Info", enterCustomerName: "Please enter a customer name.", fillItemNames: "Please fill in all item names.", item: "item", items_plural: "items", cannotUndo: "This cannot be undone.", createInvoice: "Create Invoice", issueInvoice: "Issue invoice", downloadPdf: "Download PDF", cancelInvoice: "Cancel invoice", invoiceHeading: "Invoice", noInvoiceYet: "No invoice issued yet.", invoiceIssued: "Issued", invoiceCancelled: "Cancelled", invoiceCancelTitle: "Cancel invoice?", invoiceCancelConfirm: "This issues a cancellation invoice (Storno) with a negative amount. The original invoice can no longer be changed.", invoiceCancelAction: "Issue cancellation", invoiceActionError: "The action could not be completed.", invoiceTitle: "INVOICE", invoiceFrom: "From", invoiceTo: "To", invoiceDate: "Date", invoiceNumber: "Invoice No.", invoiceItem: "Item", invoiceQty: "Qty", invoiceUnitPrice: "Unit Price", invoiceAmount: "Amount", invoiceSubtotal: "Subtotal", invoiceTotal: "Total", invoiceNotes: "Notes", invoiceGenerated: "Invoice generated successfully.", invoiceError: "Could not generate invoice.", shareInvoice: "Share Invoice", invoiceThankYou: "Thank you for your purchase!", orderDate: "Date", orderDatePlaceholder: "Order date", processingStatus: "Processing Status", processingStatusTodo: "To Do", processingStatusInProgress: "In Progress", processingStatusDone: "Done", comment: "Comment", commentPlaceholder: "Internal comment...", statusChangeError: "The status could not be changed.", deleteError: "The order could not be deleted." },
    markets: { title: "Markets", noMarkets: "No markets yet", noMarketsSub: "Add your first market event to track sales", newMarket: "New Market", editMarket: "Edit Market", eventDetails: "Event Details", marketName: "Market name", location: "Location (optional)", costs: "Costs", standFee: "Stand Fee", travelCost: "Travel Cost", notes: "Notes", additionalNotes: "Additional notes (optional)", createMarket: "Create Market", marketDetails: "Market Details", sales: "Sales", profit: "Profit", costBreakdown: "Cost Breakdown", travel: "Travel", noSales: "No sales recorded yet. Tap an article button to record a sale.", itemDescription: "Item description", deleteSale: "Delete Sale", removeSale: "Remove this sale?", deleteMarket: "Delete Market", deleteMarketConfirm: "This will also remove all associated sales.", deleteCancel: "Cancel", deleteAction: "Delete", articles: "Articles", articleName: "Article name", articlePrice: "Price", addArticle: "Add article", quickSale: "Quick Sale", otherSale: "Other Sale", copyMarket: "Copy Market", copied: "Market copied", saveMarket: "Save Market", sold: "sold", saleSaveError: "The sale could not be saved.", deleteSaleError: "The sale could not be deleted.", deleteMarketError: "The market could not be deleted.", copyError: "The market could not be copied." },
    expenses: { title: "Expenses", noExpenses: "No expenses yet", noExpensesSub: "Track your business expenses to see accurate profit", newExpense: "New Expense", description: "Description", whatSpent: "What did you spend on?", amount: "Amount", category: "Category", addExpense: "Add Expense", expenseDate: "Date", expenseDatePlaceholder: "Expense date", deleteExpense: "Delete Expense", areYouSure: "Are you sure?", cancel: "Cancel", delete: "Delete", total: "Total", fromMarket: "from market", categories: { Materials: "Materials", Shipping: "Shipping", Subscriptions: "Subscriptions", Tools: "Tools", Marketing: "Marketing", Packaging: "Packaging", Other: "Other" } },
    settings: { title: "Settings", companyProfile: "Company Profile", companyName: "Company Name", address: "Address", email: "Email", phone: "Phone", taxNote: "Tax Note (shown on invoices)", taxNotePlaceholder: "e.g. As per \u00A7 19 UStG, no VAT is charged.", smallBusinessNote: "Small business note", defaultShippingCost: "Default shipping cost", notSet: "Not set", dataBackup: "Data & Backup", exportBackup: "Export Backup", restoreBackup: "Restore from Backup", factoryReset: "Factory Reset", privacy: "Privacy", privacyText: "Vendora stores your data securely in the cloud, protected by your account. No tracking or analytics. You own 100% of your data.", exportComplete: "Export Complete", exportSuccess: "Your data has been exported successfully.", exportFailed: "Export Failed", exportError: "Could not export data. Please try again.", importComplete: "Import Complete", importSuccess: "Your data has been restored successfully.", importFailed: "Import Failed", importError: "Could not read the backup file. Please try again.", resetTitle: "Factory Reset", resetMessage: "This will permanently delete all your data. This action cannot be undone.", resetCancel: "Cancel", resetAction: "Delete Everything", resetComplete: "Reset Complete", resetSuccess: "All data has been wiped.", language: "Language", appearance: "Appearance", dark: "Dark", light: "Light", system: "System" },
    // Bewusst mehrzeilig: die übrigen Sektionen sind Kurzlabels, hier steht
    // Fließtext, der auf einer 4000-Zeichen-Zeile nicht mehr lesbar wäre.
    help: {
      title: "Help",
      subtitle: "How Vendora works — in five minutes.",
      nav: "Help",
      gettingStarted: "Getting started",
      gettingStartedBody:
        "The short version comes as a tour. It appears automatically the first time you sign in — you can watch it again here whenever you like.",
      restartTour: "Restart tour",
      tour: {
        skip: "Skip",
        back: "Back",
        next: "Next",
        done: "Let's go",
        stepOf: "Step {current} of {total}",
        welcome: {
          title: "Welcome to Vendora",
          body: "Vendora covers everything between the market stall and the tax return: record sales, write orders and invoices, keep track of expenses — and at the end of the year the P&L is already there. Three short steps and you know your way around.",
        },
        markets: {
          title: "Market mode & register",
          body: "Create a market, then open the register at your stall: one tap on an item and the sale is booked. It works without a signal too — sales stay on the device and go out as soon as you are back online. Stand fee and travel costs are entered once at the market and land in your expenses automatically.",
          cta: "Go to markets",
        },
        orders: {
          title: "Orders & invoices",
          body: "Everything you sell away from the stall becomes an order. The moment you set one to “paid”, it counts towards revenue. Every order turns into a consecutively numbered PDF invoice at the press of a button — fill in your company profile once in the settings and you are set.",
          cta: "Go to orders",
        },
        taxes: {
          title: "P&L and tax",
          body: "What counts is when the money moves: an order on the day it was paid, a market sale on the day of the market. Dashboard and tax page both read from the same source, so there is only ever one number. For your tax advisor, download the overview as CSV or PDF.",
          cta: "Go to the P&L",
        },
      },
      marketsMore:
        "A recurring market can be copied instead of typed again. Costs are only booked once a market is confirmed or completed — deliberately not while you have merely applied for a stall. That is also why stand fee and travel costs can only be changed at the market itself, not in the expense list.",
      ordersMore:
        "An issued invoice cannot be edited. Corrections go through a cancellation invoice with a negative amount, so the numbering stays gapless — which is exactly what the tax office expects.",
      taxesMore:
        "Every expense belongs to a category and the tax page groups by it. Market costs appear there on their own; there is no need to enter them twice.",
      install: {
        title: "Install as an app",
        body: "Vendora can live on your home screen: its own icon, full screen without an address bar, one tap instead of browser and bookmark. If the signal drops at the stall, the register you already have open keeps running and hands in the sales later.",
        action: "Add to home screen",
        installed: "Vendora is installed on this device.",
        iosTitle: "On iPhone or iPad:",
        iosSteps: [
          "Tap the share icon in Safari.",
          "Choose “Add to Home Screen”.",
          "Confirm with “Add”.",
        ],
        unsupported:
          "Your browser does not offer a direct install. The browser menu usually still has an option to save Vendora as an app — and everything works in a normal browser tab either way.",
        hintTitle: "Vendora as an app",
        hintBody: "Put Vendora on your home screen — then the register is one tap away at the stall.",
        hintAction: "Install",
        hintHow: "How it works",
        dismiss: "Dismiss",
      },
    },
    tabs: { dashboard: "Dashboard", orders: "Orders", markets: "Markets", expenses: "Expenses", steuer: "Tax", settings: "Settings" },
    common: { loading: "Loading...", cancel: "Cancel", delete: "Delete", confirm: "Confirm", save: "Save", loadError: "Could not load data", loadErrorSub: "Something went wrong on our side. Your data is safe — please try again.", retry: "Try again", saveError: "Something went wrong. Please try again.", notFoundTitle: "Page not found", notFoundSub: "This address does not exist — it may have been renamed or the link is incomplete.", backHome: "Back to start" },
    auth: { login: "Login", register: "Register", email: "Email", password: "Password", confirmPassword: "Confirm Password", loginSubtitle: "Sign in to your account", registerSubtitle: "Create your account", noAccount: "Don't have an account?", hasAccount: "Already have an account?", loginError: "Invalid email or password", registerError: "Could not create account. Email may already be in use.", passwordMismatch: "Passwords do not match", passwordTooShort: "Password must be at least 8 characters", logout: "Logout", account: "Account", forgotPassword: "Forgot password?", resetTitle: "Reset Password", resetEmailSubtitle: "Enter your email address and we'll send you a reset link.", sendResetLink: "Send Reset Link", resetSuccess: "Password Reset", resetSuccessMessage: "Check your email for a password reset link.", resetError: "Could not send reset link. Please try again.", emailPlaceholder: "you@example.com", passwordMinPlaceholder: "At least 8 characters", confirmPasswordPlaceholder: "Repeat password", createAccount: "Create account", verifyEmailTitle: "Confirm your email", verifyEmailBody: "We sent a confirmation email to", verifyEmailBodyEnd: "Click the link in it to activate your account.", backToLogin: "Back to login", emailSentTitle: "Email sent", verifyEmailSpamHint: "Also check your spam folder — the link is valid for 1 hour.", resendVerification: "Resend confirmation email", resendSent: "We've sent a new email.", resendIn: "Resend in", emailNotVerifiedTitle: "Email not confirmed yet", emailNotVerifiedBody: "Please confirm your email address first. We sent you a link when you registered.", verifiedTitle: "Email confirmed", verifiedBody: "Your account is active — welcome to Vendora.", toDashboard: "Go to dashboard", linkExpiredTitle: "Link expired", linkExpiredBody: "The confirmation link was only valid for one hour. Request a new one below.", invalidLinkBody: "This confirmation link is not valid. Request a new one below.", requestNewLink: "Request new link", newPasswordTitle: "New password", newPasswordSubtitle: "Choose a new password for your account.", newPassword: "New password", changePassword: "Change password", invalidLinkTitle: "Invalid link", updateError: "The password could not be changed. The link may have expired.", consentPrefix: "I accept the", consentAgb: "Terms of Service", consentSep: "and the", consentPrivacy: "Privacy Policy", consentAvvPrefix: "and enter into the", consentAvv: "Data Processing Agreement", consentAvvSuffix: "for my customers' data.", consentRequired: "Please confirm the Terms, the Privacy Policy and the Data Processing Agreement." },
    subscription: { trialDaysLeft: "{days} days left in your free trial", expired: "Free trial ended", expiredSub: "Subscribe to create new entries and generate the P&L (E\u00DCR).", upgrade: "Subscribe", upgradeTitle: "Subscribe to Vendora Pro", upgradeDescription: "Get unlimited access to all features for \u20AC19.90/month.", upgradeButton: "Subscribe for \u20AC19.90/month", features: "Create orders & invoices, track markets, manage expenses, export the P&L", currentPlan: "Current Plan", trial: "Free Trial", active: "Active Subscription", cancelled: "Cancelled", readOnly: "Read-only: this feature requires Vendora Pro." },
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  },
  de: {
    dashboard: { overview: "\u00DCbersicht", dashboard: "Dashboard", revenue: "Umsatz", expenses: "Ausgaben", netProfit: "Nettogewinn", monthlyPerformance: "Monatliche Entwicklung", openOrders: "Offene Auftr\u00E4ge", paidOrders: "Bezahlte Auftr\u00E4ge", markets: "M\u00E4rkte", allYears: "Alle", month: "Monat" },
    orders: { title: "Aufträge", noOrders: "Noch keine Aufträge", noOrdersSub: "Erstelle deinen ersten Auftrag, um Verkäufe zu verfolgen", newOrder: "Neuer Auftrag", editOrder: "Auftrag bearbeiten", invoice: "Rechnung", customer: "Kunde", customerName: "Kundenname", email: "E-Mail (optional)", street: "Straße + Hausnr.", zip: "PLZ", city: "Ort", country: "Land", streetPlaceholder: "Musterstraße 1", zipPlaceholder: "12345", cityPlaceholder: "Musterstadt", invoiceDateLabel: "Rechnungsdatum", serviceDateLabel: "Leistungsdatum", shippingCostLabel: "Versandkosten", posLabel: "Pos.", items: "Artikel", itemName: "Artikelname", qty: "Anz.", price: "Preis", notes: "Notizen", additionalNotes: "Zus\u00E4tzliche Notizen (optional)", total: "Gesamt", createOrder: "Auftrag erstellen", orderDetails: "Auftragsdetails", updateStatus: "Status \u00E4ndern", deleteOrder: "Auftrag l\u00F6schen", deleteConfirm: "M\u00F6chtest du diesen Auftrag wirklich l\u00F6schen?", deleteCancel: "Abbrechen", deleteAction: "L\u00F6schen", changeStatus: "Status \u00E4ndern", changeStatusConfirm: "Status setzen auf", confirm: "Best\u00E4tigen", missingInfo: "Fehlende Angaben", enterCustomerName: "Bitte gib einen Kundennamen ein.", fillItemNames: "Bitte f\u00FClle alle Artikelnamen aus.", item: "Artikel", items_plural: "Artikel", cannotUndo: "Dies kann nicht r\u00FCckg\u00E4ngig gemacht werden.", createInvoice: "Rechnung erstellen", issueInvoice: "Rechnung ausstellen", downloadPdf: "PDF herunterladen", cancelInvoice: "Stornieren", invoiceHeading: "Rechnung", noInvoiceYet: "Noch keine Rechnung ausgestellt.", invoiceIssued: "Ausgestellt", invoiceCancelled: "Storniert", invoiceCancelTitle: "Rechnung stornieren?", invoiceCancelConfirm: "Es wird eine Stornorechnung mit negativem Betrag erzeugt. Die Originalrechnung kann danach nicht mehr geändert werden.", invoiceCancelAction: "Stornorechnung erstellen", invoiceActionError: "Die Aktion konnte nicht ausgeführt werden.", invoiceTitle: "RECHNUNG", invoiceFrom: "Von", invoiceTo: "An", invoiceDate: "Datum", invoiceNumber: "Rechnungsnr.", invoiceItem: "Artikel", invoiceQty: "Anz.", invoiceUnitPrice: "Einzelpreis", invoiceAmount: "Betrag", invoiceSubtotal: "Zwischensumme", invoiceTotal: "Gesamtbetrag", invoiceNotes: "Anmerkungen", invoiceGenerated: "Rechnung erfolgreich erstellt.", invoiceError: "Rechnung konnte nicht erstellt werden.", shareInvoice: "Rechnung teilen", invoiceThankYou: "Vielen Dank f\u00FCr Ihren Einkauf!", orderDate: "Datum", orderDatePlaceholder: "Auftragsdatum", processingStatus: "Bearbeitungsstatus", processingStatusTodo: "Zu erledigen", processingStatusInProgress: "In Bearbeitung", processingStatusDone: "Erledigt", comment: "Kommentar", commentPlaceholder: "Interner Kommentar...", statusChangeError: "Status konnte nicht geändert werden.", deleteError: "Auftrag konnte nicht gelöscht werden." },
    markets: { title: "Märkte", noMarkets: "Noch keine Märkte", noMarketsSub: "Füge dein erstes Marktevent hinzu, um Verkäufe zu verfolgen", newMarket: "Neuer Markt", editMarket: "Markt bearbeiten", eventDetails: "Veranstaltungsdetails", marketName: "Marktname", location: "Ort (optional)", costs: "Kosten", standFee: "Standgebühr", travelCost: "Fahrtkosten", notes: "Notizen", additionalNotes: "Zusätzliche Notizen (optional)", createMarket: "Markt erstellen", marketDetails: "Marktdetails", sales: "Verkäufe", profit: "Gewinn", costBreakdown: "Kostenübersicht", travel: "Fahrt", noSales: "Noch keine Verkäufe. Tippe auf einen Artikel-Button, um einen Verkauf zu erfassen.", itemDescription: "Artikelbeschreibung", deleteSale: "Verkauf löschen", removeSale: "Diesen Verkauf entfernen?", deleteMarket: "Markt löschen", deleteMarketConfirm: "Dadurch werden auch alle zugehörigen Verkäufe entfernt.", deleteCancel: "Abbrechen", deleteAction: "Löschen", articles: "Artikel", articleName: "Artikelname", articlePrice: "Verkaufspreis", addArticle: "Artikel hinzufügen", quickSale: "Schnellverkauf", otherSale: "Sonstiger Verkauf", copyMarket: "Markt kopieren", copied: "Markt wurde kopiert", saveMarket: "Markt speichern", sold: "verkauft", saleSaveError: "Verkauf konnte nicht gespeichert werden.", deleteSaleError: "Verkauf konnte nicht gelöscht werden.", deleteMarketError: "Markt konnte nicht gelöscht werden.", copyError: "Markt konnte nicht kopiert werden." },
    expenses: { title: "Ausgaben", noExpenses: "Noch keine Ausgaben", noExpensesSub: "Verfolge deine Gesch\u00E4ftsausgaben f\u00FCr genauen Gewinn", newExpense: "Neue Ausgabe", description: "Beschreibung", whatSpent: "Wof\u00FCr hast du ausgegeben?", amount: "Betrag", category: "Kategorie", addExpense: "Ausgabe hinzuf\u00FCgen", expenseDate: "Datum", expenseDatePlaceholder: "Ausgabedatum", deleteExpense: "Ausgabe l\u00F6schen", areYouSure: "Bist du sicher?", cancel: "Abbrechen", delete: "L\u00F6schen", total: "Gesamt", fromMarket: "aus Markt", categories: { Materials: "Materialien", Shipping: "Versand", Subscriptions: "Abonnements", Tools: "Werkzeuge", Marketing: "Marketing", Packaging: "Verpackung", Other: "Sonstiges" } },
    settings: { title: "Einstellungen", companyProfile: "Firmenprofil", companyName: "Firmenname", address: "Adresse", email: "E-Mail", phone: "Telefon", taxNote: "Steuerhinweis (auf Rechnungen)", taxNotePlaceholder: "z.B. Gem. §19 UStG wird keine Umsatzsteuer berechnet.", smallBusinessNote: "Kleinunternehmer-Hinweis", defaultShippingCost: "Standardversandkosten", notSet: "Nicht gesetzt", dataBackup: "Daten & Sicherung", exportBackup: "Backup exportieren", restoreBackup: "Aus Backup wiederherstellen", factoryReset: "Werkseinstellungen", privacy: "Datenschutz", privacyText: "Vendora speichert deine Daten sicher in der Cloud, gesch\u00FCtzt durch dein Konto. Kein Tracking, keine Analysen. Du besitzt 100% deiner Daten.", exportComplete: "Export abgeschlossen", exportSuccess: "Deine Daten wurden erfolgreich exportiert.", exportFailed: "Export fehlgeschlagen", exportError: "Daten konnten nicht exportiert werden. Bitte versuche es erneut.", importComplete: "Import abgeschlossen", importSuccess: "Deine Daten wurden erfolgreich wiederhergestellt.", importFailed: "Import fehlgeschlagen", importError: "Die Backup-Datei konnte nicht gelesen werden. Bitte versuche es erneut.", resetTitle: "Werkseinstellungen", resetMessage: "Dadurch werden alle Daten dauerhaft gel\u00F6scht. Diese Aktion kann nicht r\u00FCckg\u00E4ngig gemacht werden.", resetCancel: "Abbrechen", resetAction: "Alles l\u00F6schen", resetComplete: "Zur\u00FCcksetzen abgeschlossen", resetSuccess: "Alle Daten wurden gel\u00F6scht.", language: "Sprache", appearance: "Darstellung", dark: "Dunkel", light: "Hell", system: "System" },
    help: {
      title: "Hilfe",
      subtitle: "Wie Vendora funktioniert \u2014 in f\u00FCnf Minuten.",
      nav: "Hilfe",
      gettingStarted: "Erste Schritte",
      gettingStartedBody:
        "Die Kurzfassung gibt es als Tour. Sie erscheint beim ersten Anmelden automatisch \u2014 hier kannst du sie dir jederzeit noch einmal ansehen.",
      restartTour: "Tour erneut starten",
      tour: {
        skip: "\u00DCberspringen",
        back: "Zur\u00FCck",
        next: "Weiter",
        done: "Los geht's",
        stepOf: "Schritt {current} von {total}",
        welcome: {
          title: "Willkommen bei Vendora",
          body: "Vendora deckt ab, was zwischen Marktstand und Steuererkl\u00E4rung anf\u00E4llt: Verk\u00E4ufe erfassen, Auftr\u00E4ge und Rechnungen schreiben, Ausgaben festhalten \u2014 und am Jahresende steht die E\u00DCR schon da. Drei kurze Schritte, dann kennst du den Weg.",
        },
        markets: {
          title: "Marktmodus & Kasse",
          body: "Leg einen Markt an und \u00F6ffne am Stand die Kasse: ein Tipp auf einen Artikel, der Verkauf ist gebucht. Das geht auch ohne Empfang \u2014 die Verk\u00E4ufe bleiben so lange auf dem Ger\u00E4t und gehen raus, sobald wieder Netz da ist. Standgeb\u00FChr und Fahrtkosten tr\u00E4gst du einmal am Markt ein, sie landen von allein in den Ausgaben.",
          cta: "Zu den M\u00E4rkten",
        },
        orders: {
          title: "Auftr\u00E4ge & Rechnungen",
          body: "Alles, was du abseits vom Stand verkaufst, wird zum Auftrag. Sobald du ihn auf \u201Ebezahlt\u201C setzt, z\u00E4hlt er zum Umsatz. Aus jedem Auftrag entsteht auf Knopfdruck eine fortlaufend nummerierte Rechnung als PDF \u2014 Firmenprofil einmal in den Einstellungen hinterlegen, das war's.",
          cta: "Zu den Auftr\u00E4gen",
        },
        taxes: {
          title: "E\u00DCR & Steuer",
          body: "Gez\u00E4hlt wird, wann das Geld flie\u00DFt: ein Auftrag am Tag der Zahlung, ein Marktverkauf am Markttag. Dashboard und Steuerseite rechnen aus derselben Quelle, es gibt also immer nur eine Zahl. F\u00FCr die Steuerberatung l\u00E4dst du die \u00DCbersicht als CSV oder PDF herunter.",
          cta: "Zur E\u00DCR",
        },
      },
      marketsMore:
        "Einen Markt, der regelm\u00E4\u00DFig stattfindet, kannst du kopieren statt neu anzulegen. Kosten werden erst gebucht, wenn ein Markt best\u00E4tigt oder abgeschlossen ist \u2014 bewusst nicht schon dann, wenn du dich nur beworben hast. Deshalb lassen sich Standgeb\u00FChr und Fahrtkosten auch nur am Markt selbst \u00E4ndern, nicht in der Ausgabenliste.",
      ordersMore:
        "Eine ausgestellte Rechnung ist unver\u00E4nderlich. Korrigiert wird \u00FCber eine Stornorechnung mit negativem Betrag, damit die Nummernfolge l\u00FCckenlos bleibt \u2014 genau so erwartet es das Finanzamt.",
      taxesMore:
        "Jede Ausgabe geh\u00F6rt zu einer Kategorie, danach gruppiert die Steuerseite. Marktkosten stehen dort von allein; du musst sie nicht doppelt erfassen.",
      install: {
        title: "Als App installieren",
        body: "Vendora kann auf dem Startbildschirm liegen: eigenes Symbol, Vollbild ohne Adressleiste, ein Tipp statt Browser und Lesezeichen. Bricht am Stand das Netz weg, l\u00E4uft die bereits ge\u00F6ffnete Kasse weiter und reicht die Verk\u00E4ufe sp\u00E4ter nach.",
        action: "Auf dem Startbildschirm speichern",
        installed: "Vendora ist auf diesem Ger\u00E4t installiert.",
        iosTitle: "Auf iPhone oder iPad:",
        iosSteps: [
          "Tippe in Safari auf das Teilen-Symbol.",
          "W\u00E4hle \u201EZum Home-Bildschirm\u201C.",
          "Best\u00E4tige mit \u201EHinzuf\u00FCgen\u201C.",
        ],
        unsupported:
          "Dein Browser bietet keine direkte Installation an. \u00DCber das Browsermen\u00FC l\u00E4sst sich Vendora meist trotzdem als App speichern \u2014 und im normalen Browser-Tab funktioniert ohnehin alles.",
        hintTitle: "Vendora als App",
        hintBody: "Leg Vendora auf den Startbildschirm \u2014 dann ist die Kasse am Stand einen Tipp entfernt.",
        hintAction: "Installieren",
        hintHow: "So geht's",
        dismiss: "Ausblenden",
      },
    },
    tabs: { dashboard: "Dashboard", orders: "Auftr\u00E4ge", markets: "M\u00E4rkte", expenses: "Ausgaben", steuer: "Steuer", settings: "Einstellungen" },
    common: { loading: "Laden...", cancel: "Abbrechen", delete: "L\u00F6schen", confirm: "Best\u00E4tigen", save: "Speichern", loadError: "Daten konnten nicht geladen werden", loadErrorSub: "Auf unserer Seite ist etwas schiefgelaufen. Deine Daten sind sicher \u2014 bitte versuche es erneut.", retry: "Erneut versuchen", saveError: "Ein Fehler ist aufgetreten. Bitte versuche es erneut.", notFoundTitle: "Seite nicht gefunden", notFoundSub: "Diese Adresse gibt es nicht — vielleicht wurde sie umbenannt oder der Link ist unvollständig.", backHome: "Zurück zum Start" },
    auth: { login: "Anmelden", register: "Registrieren", email: "E-Mail", password: "Passwort", confirmPassword: "Passwort best\u00E4tigen", loginSubtitle: "Melde dich bei deinem Konto an", registerSubtitle: "Erstelle dein Konto", noAccount: "Noch kein Konto?", hasAccount: "Bereits ein Konto?", loginError: "Ung\u00FCltige E-Mail oder Passwort", registerError: "Konto konnte nicht erstellt werden. E-Mail ist m\u00F6glicherweise bereits vergeben.", passwordMismatch: "Passw\u00F6rter stimmen nicht \u00FCberein", passwordTooShort: "Passwort muss mindestens 8 Zeichen lang sein", logout: "Abmelden", account: "Konto", forgotPassword: "Passwort vergessen?", resetTitle: "Passwort zur\u00FCcksetzen", resetEmailSubtitle: "Gib deine E-Mail-Adresse ein und wir senden dir einen Reset-Link.", sendResetLink: "Reset-Link senden", resetSuccess: "Passwort zur\u00FCckgesetzt", resetSuccessMessage: "Pr\u00FCfe dein E-Mail-Postfach f\u00FCr den Reset-Link.", resetError: "Reset-Link konnte nicht gesendet werden. Bitte versuche es erneut.", emailPlaceholder: "deine@email.de", passwordMinPlaceholder: "Mindestens 8 Zeichen", confirmPasswordPlaceholder: "Passwort wiederholen", createAccount: "Konto erstellen", verifyEmailTitle: "Bestätige deine E-Mail", verifyEmailBody: "Wir haben eine Bestätigungs-E-Mail gesendet an", verifyEmailBodyEnd: "Klicke auf den Link in der E-Mail, um dein Konto zu aktivieren.", backToLogin: "Zurück zum Login", emailSentTitle: "E-Mail gesendet", verifyEmailSpamHint: "Schau auch im Spam-Ordner nach — der Link ist 1 Stunde gültig.", resendVerification: "Bestätigungs-E-Mail erneut senden", resendSent: "Wir haben dir eine neue E-Mail gesendet.", resendIn: "Erneut senden in", emailNotVerifiedTitle: "E-Mail noch nicht bestätigt", emailNotVerifiedBody: "Bitte bestätige zuerst deine E-Mail-Adresse. Bei der Registrierung haben wir dir einen Link geschickt.", verifiedTitle: "E-Mail bestätigt", verifiedBody: "Dein Konto ist aktiv — willkommen bei Vendora.", toDashboard: "Zum Dashboard", linkExpiredTitle: "Link abgelaufen", linkExpiredBody: "Der Bestätigungslink war nur eine Stunde gültig. Fordere unten einen neuen an.", invalidLinkBody: "Dieser Bestätigungslink ist ungültig. Fordere unten einen neuen an.", requestNewLink: "Neuen Link anfordern", newPasswordTitle: "Neues Passwort", newPasswordSubtitle: "Wähle ein neues Passwort für dein Konto.", newPassword: "Neues Passwort", changePassword: "Passwort ändern", invalidLinkTitle: "Ungültiger Link", updateError: "Passwort konnte nicht geändert werden. Der Link ist möglicherweise abgelaufen.", consentPrefix: "Ich akzeptiere die", consentAgb: "AGB", consentSep: "und die", consentPrivacy: "Datenschutzerklärung", consentAvvPrefix: "und schließe den", consentAvv: "Auftragsverarbeitungsvertrag", consentAvvSuffix: "für die Daten meiner Kundinnen und Kunden.", consentRequired: "Bitte bestätige AGB, Datenschutzerklärung und Auftragsverarbeitungsvertrag." },
    subscription: { trialDaysLeft: "Noch {days} Tage in deiner kostenlosen Testphase", expired: "Testphase beendet", expiredSub: "Abonniere Vendora Pro, um neue Eintr\u00E4ge anzulegen und die GuV/E\u00DCR zu erstellen.", upgrade: "Abonnieren", upgradeTitle: "Vendora Pro abonnieren", upgradeDescription: "Unbegrenzter Zugang zu allen Funktionen f\u00FCr 19,90 \u20AC/Monat.", upgradeButton: "Abonnieren f\u00FCr 19,90 \u20AC/Monat", features: "Auftr\u00E4ge & Rechnungen erstellen, M\u00E4rkte verfolgen, Ausgaben verwalten, GuV exportieren", currentPlan: "Aktueller Plan", trial: "Kostenlose Testphase", active: "Aktives Abonnement", cancelled: "Gek\u00FCndigt", readOnly: "Nur-Lese-Modus: Diese Funktion erfordert Vendora Pro." },
    months: ["Jan", "Feb", "M\u00E4r", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"],
  },
};

export type Translations = typeof translations.en;

export function getTranslations(lang: Language): Translations {
  return translations[lang];
}

export { translations };
