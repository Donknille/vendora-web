"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { useLanguage } from "@/lib/context/LanguageContext";
import { useTheme } from "@/lib/context/ThemeContext";
import { useProfile, useUpdateProfile } from "@/lib/hooks/useProfile";
import { useAppSettings, useUpdateSettings } from "@/lib/hooks/useSettings";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";

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
      setCompanyName(profile.name ?? profile.companyName ?? "");
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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile.mutateAsync({
      name: companyName.trim(),
      companyName: companyName.trim(),
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
    if (!sub) return "text-zinc-400";
    switch (sub.status) {
      case "trial":
        return "text-yellow-400";
      case "active":
        return "text-emerald-400";
      case "expired":
      case "cancelled":
        return "text-red-400";
      default:
        return "text-zinc-400";
    }
  })();

  const inputClass =
    "w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors";

  const isLoading = loadingProfile || loadingSettings;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-zinc-500">{t.common.loading}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      {/* Header */}
      <h1 className="text-2xl font-bold text-zinc-100">{t.settings.title}</h1>

      {/* ───────── Account ───────── */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <User className="h-5 w-5 text-emerald-500" />
          <h2 className="text-base font-semibold text-zinc-100">
            {t.auth.account}
          </h2>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">{t.auth.email}</span>
            <span className="text-sm text-zinc-200">
              {userEmail ?? t.settings.notSet}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">
              {t.subscription.currentPlan}
            </span>
            <span className={`text-sm font-medium ${subscriptionColor}`}>
              {subscriptionLabel}
            </span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-4 py-2 text-sm font-medium text-red-400 hover:bg-zinc-800 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          {t.auth.logout}
        </button>
      </Card>

      {/* ───────── Company Profile ───────── */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <Building2 className="h-5 w-5 text-emerald-500" />
          <h2 className="text-base font-semibold text-zinc-100">
            {t.settings.companyProfile}
          </h2>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-300">
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
            <label className="mb-1 block text-sm font-medium text-zinc-300">
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
              <label className="mb-1 block text-sm font-medium text-zinc-300">
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
              <label className="mb-1 block text-sm font-medium text-zinc-300">
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
            <label className="mb-1 block text-sm font-medium text-zinc-300">
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
            <label className="mb-1 block text-sm font-medium text-zinc-300">
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
            <label className="mb-1 block text-sm font-medium text-zinc-300">
              Standardversandkosten
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
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {profileSaved && <Check className="h-4 w-4" />}
            {updateProfile.isPending
              ? t.common.loading
              : profileSaved
                ? t.common.save + " ✓"
                : t.common.save}
          </button>
        </form>
      </Card>

      {/* ───────── Appearance ───────── */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <Palette className="h-5 w-5 text-emerald-500" />
          <h2 className="text-base font-semibold text-zinc-100">
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
                  ? "bg-emerald-500 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
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
          <Globe className="h-5 w-5 text-emerald-500" />
          <h2 className="text-base font-semibold text-zinc-100">
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
                  ? "bg-emerald-500 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
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
          <Database className="h-5 w-5 text-emerald-500" />
          <h2 className="text-base font-semibold text-zinc-100">
            {t.settings.dataBackup}
          </h2>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={handleExport}
            disabled={exportStatus === "loading"}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
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
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
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

      {/* ───────── Privacy ───────── */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <Shield className="h-5 w-5 text-emerald-500" />
          <h2 className="text-base font-semibold text-zinc-100">
            {t.settings.privacy}
          </h2>
        </div>

        <p className="text-sm text-zinc-400 leading-relaxed">
          {t.settings.privacyText}
        </p>
      </Card>
    </div>
  );
}
