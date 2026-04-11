"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User,
  Building2,
  Palette,
  Globe,
  Database,
  Shield,
  LogOut,
  Download,
  Upload,
  Check,
  Sun,
  Moon,
  Monitor,
  Trash2,
} from "lucide-react";
import { useLanguage } from "@/lib/context/LanguageContext";
import { useTheme } from "@/lib/context/ThemeContext";
import { useProfile, useUpdateProfile } from "@/lib/hooks/useProfile";
import { useAppSettings, useUpdateSettings } from "@/lib/hooks/useSettings";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export default function SettingsPage() {
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const { data: profile, isLoading: loadingProfile } = useProfile();
  const { data: settings, isLoading: loadingSettings } = useAppSettings();
  const { data: sub } = useSubscription();

  const updateProfile = useUpdateProfile();
  const updateSettings = useUpdateSettings();

  // Profile form state
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [taxNote, setTaxNote] = useState("");
  const [smallBusinessNote, setSmallBusinessNote] = useState("");
  const [defaultShippingCost, setDefaultShippingCost] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);

  // User email state
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Export/Import state
  const [exportStatus, setExportStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [importStatus, setImportStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete account
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);

  // Load user email
  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      setUserEmail(data.user?.email ?? null);
    };
    loadUser();
  }, []);

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setCompanyName(profile.name ?? "");
      setAddress(profile.address ?? "");
      setEmail(profile.email ?? "");
      setPhone(profile.phone ?? "");
      setTaxNote(profile.taxNote ?? "");
      setSmallBusinessNote(profile.smallBusinessNote ?? "");
      setDefaultShippingCost(
        profile.defaultShippingCost != null
          ? String(profile.defaultShippingCost)
          : ""
      );
    }
  }, [profile]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const [profileError, setProfileError] = useState("");

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");
    try {
      await updateProfile.mutateAsync({
        name: companyName.trim(),
        address: address.trim(),
        email: email.trim(),
        phone: phone.trim(),
        taxNote: taxNote.trim(),
        smallBusinessNote: smallBusinessNote.trim(),
        defaultShippingCost: defaultShippingCost
          ? parseFloat(defaultShippingCost.replace(",", ".")) || 0
          : 0,
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch {
      setProfileError("Profil konnte nicht gespeichert werden.");
    }
  };

  const handleExport = async () => {
    setExportStatus("loading");
    try {
      const res = await fetch("/api/export");
      if (!res.ok) throw new Error("Export failed");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vendora-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportStatus("success");
      setTimeout(() => setExportStatus("idle"), 3000);
    } catch {
      setExportStatus("error");
      setTimeout(() => setExportStatus("idle"), 3000);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus("loading");
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await fetch("/api/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Import failed");
      setImportStatus("success");
      setTimeout(() => setImportStatus("idle"), 3000);
    } catch {
      setImportStatus("error");
      setTimeout(() => setImportStatus("idle"), 3000);
    }
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const subscriptionLabel = (() => {
    if (!sub) return "—";
    switch (sub.status) {
      case "trial":
        return `${t.subscription.trial}${sub.daysRemaining !== null ? ` (${sub.daysRemaining}d)` : ""}`;
      case "active":
        return t.subscription.active;
      case "expired":
        return t.subscription.expired;
      case "cancelled":
        return t.subscription.cancelled;
      default:
        return "—";
    }
  })();

  const subscriptionColor = (() => {
    if (!sub) return "text-faint";
    switch (sub.status) {
      case "trial":
        return "text-yellow-400";
      case "active":
        return "text-brand-primary";
      case "expired":
      case "cancelled":
        return "text-red-400";
      default:
        return "text-faint";
    }
  })();

  const inputClass =
    "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-primary placeholder-holder outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition-colors";

  const isLoading = loadingProfile || loadingSettings;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted">{t.common.loading}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      {/* Header */}
      <h1 className="text-2xl font-bold text-primary font-display">{t.settings.title}</h1>

      {/* ───────── Account ───────── */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <User className="h-5 w-5 text-brand-primary" />
          <h2 className="text-base font-semibold text-primary">
            {t.auth.account}
          </h2>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-faint">{t.auth.email}</span>
            <span className="text-sm text-secondary">
              {userEmail ?? t.settings.notSet}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-faint">
              {t.subscription.currentPlan}
            </span>
            <span className={`text-sm font-medium ${subscriptionColor}`}>
              {subscriptionLabel}
            </span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-medium text-red-400 hover:bg-elevated transition-colors"
        >
          <LogOut className="h-4 w-4" />
          {t.auth.logout}
        </button>
      </Card>

      {/* ───────── Company Profile ───────── */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <Building2 className="h-5 w-5 text-brand-primary" />
          <h2 className="text-base font-semibold text-primary">
            {t.settings.companyProfile}
          </h2>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">
              {t.settings.companyName}
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className={inputClass}
              placeholder={t.settings.companyName}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">
              {t.settings.address}
            </label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={`${inputClass} resize-none`}
              rows={2}
              placeholder={t.settings.address}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">
                {t.settings.email}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder={t.settings.email}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">
                {t.settings.phone}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
                placeholder={t.settings.phone}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">
              {t.settings.taxNote}
            </label>
            <input
              type="text"
              value={taxNote}
              onChange={(e) => setTaxNote(e.target.value)}
              className={inputClass}
              placeholder={t.settings.taxNotePlaceholder}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">
              Kleinunternehmerregelung
            </label>
            <input
              type="text"
              value={smallBusinessNote}
              onChange={(e) => setSmallBusinessNote(e.target.value)}
              className={inputClass}
              placeholder={t.settings.taxNotePlaceholder}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">
              {t.settings.defaultShippingCost}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={defaultShippingCost}
              onChange={(e) => setDefaultShippingCost(e.target.value)}
              className={inputClass}
              placeholder="0,00"
            />
          </div>

          <button
            type="submit"
            disabled={updateProfile.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {profileSaved && <Check className="h-4 w-4" />}
            {updateProfile.isPending
              ? t.common.loading
              : profileSaved
                ? t.common.save + " ✓"
                : t.common.save}
          </button>
          {profileError && <p className="mt-2 text-sm text-red-400">{profileError}</p>}
        </form>
      </Card>

      {/* ───────── Appearance ───────── */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <Palette className="h-5 w-5 text-brand-primary" />
          <h2 className="text-base font-semibold text-primary">
            {t.settings.appearance}
          </h2>
        </div>

        <div className="flex gap-2">
          {([
            { value: "light" as const, label: t.settings.light, icon: Sun },
            { value: "dark" as const, label: t.settings.dark, icon: Moon },
            { value: "system" as const, label: t.settings.system, icon: Monitor },
          ]).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                theme === value
                  ? "bg-brand-primary text-white"
                  : "bg-elevated text-faint hover:bg-hover hover:text-secondary"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </Card>

      {/* ───────── Language ───────── */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <Globe className="h-5 w-5 text-brand-primary" />
          <h2 className="text-base font-semibold text-primary">
            {t.settings.language}
          </h2>
        </div>

        <div className="flex gap-2">
          {([
            { value: "de" as const, label: "Deutsch" },
            { value: "en" as const, label: "English" },
          ]).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setLanguage(value)}
              className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                language === value
                  ? "bg-brand-primary text-white"
                  : "bg-elevated text-faint hover:bg-hover hover:text-secondary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      {/* ───────── Data & Backup ───────── */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <Database className="h-5 w-5 text-brand-primary" />
          <h2 className="text-base font-semibold text-primary">
            {t.settings.dataBackup}
          </h2>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={handleExport}
            disabled={exportStatus === "loading"}
            className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-secondary hover:bg-elevated disabled:opacity-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            {exportStatus === "loading"
              ? t.common.loading
              : exportStatus === "success"
                ? t.settings.exportSuccess
                : exportStatus === "error"
                  ? t.settings.exportError
                  : t.settings.exportBackup}
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importStatus === "loading"}
            className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-secondary hover:bg-elevated disabled:opacity-50 transition-colors"
          >
            <Upload className="h-4 w-4" />
            {importStatus === "loading"
              ? t.common.loading
              : importStatus === "success"
                ? t.settings.importSuccess
                : importStatus === "error"
                  ? t.settings.importError
                  : t.settings.restoreBackup}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </div>
      </Card>

      {/* ───────── Privacy & Legal ───────── */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <Shield className="h-5 w-5 text-brand-primary" />
          <h2 className="text-base font-semibold text-primary">
            {t.settings.privacy}
          </h2>
        </div>

        <p className="text-sm text-faint leading-relaxed mb-4">
          {t.settings.privacyText}
        </p>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/legal/datenschutz"
            className="text-sm text-brand-primary hover:text-brand-primary/80 transition-colors"
          >
            Datenschutzerklärung →
          </Link>
          <Link
            href="/legal/agb"
            className="text-sm text-brand-primary hover:text-brand-primary/80 transition-colors"
          >
            AGB →
          </Link>
          <Link
            href="/legal/impressum"
            className="text-sm text-brand-primary hover:text-brand-primary/80 transition-colors"
          >
            Impressum →
          </Link>
          <Link
            href="/legal/changelog"
            className="text-sm text-brand-primary hover:text-brand-primary/80 transition-colors"
          >
            Changelog →
          </Link>
        </div>
      </Card>

      {/* ───────── Danger Zone ───────── */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <Trash2 className="h-5 w-5 text-red-400" />
          <h2 className="text-base font-semibold text-primary">
            {language === "de" ? "Konto löschen" : "Delete Account"}
          </h2>
        </div>
        <p className="text-sm text-faint mb-4">
          {language === "de"
            ? "Alle deine Daten werden unwiderruflich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden."
            : "All your data will be permanently deleted. This action cannot be undone."}
        </p>
        <button
          onClick={() => setShowDeleteAccount(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          {language === "de" ? "Konto und alle Daten löschen" : "Delete account and all data"}
        </button>
      </Card>

      {/* Delete Account Dialog */}
      <ConfirmDialog
        open={showDeleteAccount}
        onClose={() => setShowDeleteAccount(false)}
        onConfirm={async () => {
          try {
            await fetch("/api/account", { method: "DELETE" });
            const supabase = createClient();
            await supabase.auth.signOut();
            router.push("/auth/login");
          } catch {
            // ignore
          }
        }}
        title={language === "de" ? "Konto löschen" : "Delete Account"}
        message={language === "de"
          ? "Bist du sicher? Alle Aufträge, Märkte, Ausgaben und dein Firmenprofil werden unwiderruflich gelöscht."
          : "Are you sure? All orders, markets, expenses and your company profile will be permanently deleted."}
        confirmText={language === "de" ? "Endgültig löschen" : "Delete permanently"}
        cancelText={t.common.cancel}
      />
    </div>
  );
}
