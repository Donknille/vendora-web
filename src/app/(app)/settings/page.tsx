"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  HelpCircle,
} from "lucide-react";
import { useLanguage } from "@/lib/context/LanguageContext";
import { apiErrorMessage } from "@/lib/apiError";
import { useTheme } from "@/lib/context/ThemeContext";
import { useProfile, useUpdateProfile } from "@/lib/hooks/useProfile";
import { useSubscription, invalidateSubscription } from "@/lib/hooks/useSubscription";
import { useCurrentUserId } from "@/lib/context/AuthContext";
import { useStripeCheckout } from "@/lib/hooks/useStripeCheckout";
import { authClient } from "@/lib/auth-client";
import { clearLocalData } from "@/lib/clearLocalData";
import { parseAmount, formatAmountInput } from "@/lib/formatCurrency";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ReferralCard } from "@/components/ReferralCard";
import { InstallAppCard } from "@/components/pwa/InstallAppCard";
import { today } from "@/lib/date";
import { labelTight, inputSurface } from "@/lib/styles";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { apiRequest } from "@/lib/api-client";

export default function SettingsPage() {
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = useCurrentUserId();

  const { data: profile, isLoading: loadingProfile } = useProfile();
  const { data: sub } = useSubscription();

  // Stripe schickt nach dem Checkout hierher (?subscription=success). Der
  // persistierte Cache kennt noch den alten Plan — einmal frisch holen.
  const checkoutResult = searchParams.get("subscription");
  useEffect(() => {
    if (checkoutResult === "success") invalidateSubscription(userId);
  }, [checkoutResult, userId]);
  const { redirectToCheckout: handleSubscribe, loading: subscribeLoading, error: subscribeError } = useStripeCheckout();
  const [portalLoading, setPortalLoading] = useState(false);

  const [portalError, setPortalError] = useState("");
  const handleManageSubscription = async () => {
    setPortalLoading(true);
    setPortalError("");
    try {
      const res = await apiRequest("POST", "/api/stripe/portal");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("missing url");
    } catch (e) {
      // Vorher blieb der Knopf ohne `res.ok`-Pruefung dauerhaft auf "Laden…".
      setPortalError(apiErrorMessage(e, language, t.common.saveError));
    } finally {
      setPortalLoading(false);
    }
  };

  const updateProfile = useUpdateProfile();
  // Profile form state
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [taxNote, setTaxNote] = useState("");
  const [smallBusinessNote, setSmallBusinessNote] = useState("");
  const [isSmallBusiness, setIsSmallBusiness] = useState(true);
  const [defaultShippingCost, setDefaultShippingCost] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);

  // User email state
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Export/Import state
  const [exportStatus, setExportStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [importStatus, setImportStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);

  // Delete account
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);

  // Load user email
  useEffect(() => {
    const loadUser = async () => {
      const { data } = await authClient.getSession();
      setUserEmail(data?.user?.email ?? null);
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
      setIsSmallBusiness(profile.isSmallBusiness ?? true);
      setDefaultShippingCost(
        profile.defaultShippingCost != null
          ? formatAmountInput(profile.defaultShippingCost)
          : ""
      );
    }
  }, [profile]);

  const handleLogout = async () => {
    await clearLocalData();
    await authClient.signOut();
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
        isSmallBusiness,
        defaultShippingCost: defaultShippingCost
          ? parseAmount(defaultShippingCost)
          : 0,
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch {
      setProfileError(t.settings.theProfileCouldNot);
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
      a.download = `bilanz-buddy-backup-${today()}.json`;
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingImportFile(file);
    setShowImportConfirm(true);
    // Reset file input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImportConfirm = async () => {
    if (!pendingImportFile) return;
    setImportStatus("loading");
    setImportError("");
    try {
      const text = await pendingImportFile.text();
      const data = JSON.parse(text);
      const res = await fetch("/api/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        // Der Server weiss, warum es nicht ging (Pro noetig, Datei zu gross,
        // falsches Format). Diese Begruendung gehoert vor die Nutzer:innen.
        // Bekannte Codes werden uebersetzt, alles andere durchgereicht.
        const body = await res.json().catch(() => ({}));
        if (body.code === "PRO_REQUIRED") {
          throw new Error(
            t.settings.restoringABackupRequires,
          );
        }
        throw new Error(
          typeof body.message === "string" && body.message ? body.message : "",
        );
      }
      setImportStatus("success");
      setTimeout(() => setImportStatus("idle"), 3000);
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      setImportError(
        message ||
          (t.settings.theFileCouldNot),
      );
      setImportStatus("error");
    }
    setPendingImportFile(null);
    setShowImportConfirm(false);
  };

  const subscriptionLabel = (() => {
    if (!sub) return "—";
    if (sub.plan === "pro") {
      const until =
        sub.expiresAt != null
          ? ` (${t.settings.until} ${new Date(sub.expiresAt).toLocaleDateString((language === "de" ? "de-DE" : "en-US"))})`
          : "";
      return `Pro${until}`;
    }
    if (sub.plan === "trial") {
      const days = sub.trialDaysLeft ?? 0;
      return language === "de" ? `Testphase (noch ${days} Tage)` : `Trial (${days} days left)`;
    }
    return t.settings.freeReadOnly;
  })();

  const subscriptionColor =
    sub?.plan === "pro" || sub?.plan === "trial" ? "text-brand-primary" : "text-secondary";

  // Der Restore ist bewusst Pro-only (nicht Trial) — dieselbe Regel wie in
  // POST /api/migrate. Solange der Plan noch laedt, bleibt der Button aktiv;
  // der Server entscheidet ohnehin.
  const importAllowed = sub == null || sub.plan === "pro";


  const isLoading = loadingProfile;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl">
        <ListSkeleton count={4} />
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

          {sub && sub.plan !== "pro" && (
            <button
              onClick={handleSubscribe}
              disabled={subscribeLoading}
              className="w-full rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-primary/90 disabled:opacity-50 transition-colors"
            >
              {subscribeLoading ? t.common.loading : t.subscription.upgradeButton}
            </button>
          )}

          {subscribeError != null && (
            <p className="text-sm text-red-500">
              {apiErrorMessage(subscribeError, language, t.common.saveError)}
            </p>
          )}

          {sub && sub.plan === "pro" && (
            <>
              <button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="w-full rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-secondary hover:bg-elevated disabled:opacity-50 transition-colors"
              >
                {portalLoading ? t.common.loading : (t.settings.manageCancelSubscription)}
              </button>
              {portalError && <p className="mt-2 text-sm text-red-400">{portalError}</p>}
            </>
          )}
        </div>

        <button
          onClick={handleLogout}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-medium text-red-400 hover:bg-elevated transition-colors"
        >
          <LogOut className="h-4 w-4" />
          {t.auth.logout}
        </button>
      </Card>

      {/* Referral slot (Phase 4.4): only rendered when a link is configured. */}
      <ReferralCard
        url={process.env.NEXT_PUBLIC_INSURANCE_REFERRAL_URL}
        title={t.settings.tradeLiabilityInsurance}
        description={
          t.settings.coverYourStallGoods
        }
        cta={t.settings.compareQuotes}
        de={language === "de"}
      />

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
            <label htmlFor="settings-1" className={labelTight}>
              {t.settings.companyName}
            </label>
            <input id="settings-1"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className={inputSurface}
              placeholder={t.settings.companyName}
            />
          </div>

          <div>
            <label htmlFor="settings-2" className={labelTight}>
              {t.settings.address}
            </label>
            <textarea id="settings-2"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={`${inputSurface} resize-none`}
              rows={2}
              placeholder={t.settings.address}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="settings-3" className={labelTight}>
                {t.settings.email}
              </label>
              <input id="settings-3"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputSurface}
                placeholder={t.settings.email}
              />
            </div>
            <div>
              <label htmlFor="settings-4" className={labelTight}>
                {t.settings.phone}
              </label>
              <input id="settings-4"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputSurface}
                placeholder={t.settings.phone}
              />
            </div>
          </div>

          <div>
            <label htmlFor="settings-5" className={labelTight}>
              {t.settings.taxNote}
            </label>
            <input id="settings-5"
              type="text"
              value={taxNote}
              onChange={(e) => setTaxNote(e.target.value)}
              className={inputSurface}
              placeholder={t.settings.taxNotePlaceholder}
            />
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isSmallBusiness}
              onChange={(e) => setIsSmallBusiness(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-line text-brand-primary focus:ring-brand-primary"
            />
            <span className="text-sm text-secondary">
              {t.settings.smallBusinessUnder19}
            </span>
          </label>

          <div>
            <label htmlFor="settings-6" className={labelTight}>
              {t.settings.additionalTaxNote}
            </label>
            <input id="settings-6"
              type="text"
              value={smallBusinessNote}
              onChange={(e) => setSmallBusinessNote(e.target.value)}
              className={inputSurface}
              placeholder={t.settings.taxNotePlaceholder}
            />
          </div>

          <div>
            <label htmlFor="settings-7" className={labelTight}>
              {t.settings.defaultShippingCost}
            </label>
            <input id="settings-7"
              type="text"
              inputMode="decimal"
              value={defaultShippingCost}
              onChange={(e) => setDefaultShippingCost(e.target.value)}
              className={inputSurface}
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

      {/* ───────── Hilfe & Tutorial ───────── */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <HelpCircle className="h-5 w-5 text-brand-primary" />
          <h2 className="text-base font-semibold text-primary">{t.help.title}</h2>
        </div>

        <p className="text-sm text-faint leading-relaxed mb-4">
          {t.help.gettingStartedBody}
        </p>

        <Link
          href="/hilfe"
          className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-secondary hover:bg-elevated transition-colors"
        >
          <HelpCircle className="h-4 w-4" />
          {t.help.title}
        </Link>
      </Card>

      {/* ───────── Als App installieren ───────── */}
      <InstallAppCard />

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
            disabled={importStatus === "loading" || !importAllowed}
            title={
              importAllowed
                ? undefined
                : t.settings.importIsAPro
            }
            className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-secondary hover:bg-elevated disabled:opacity-50 transition-colors"
          >
            <Upload className="h-4 w-4" />
            {importStatus === "loading"
              ? t.common.loading
              : importStatus === "success"
                ? t.settings.importSuccess
                : t.settings.restoreBackup}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Das Gate steht VOR dem Dateidialog: sonst waehlt man erst eine Datei
            aus und erfaehrt danach, dass der Import nicht freigeschaltet ist. */}
        {!importAllowed && (
          <p className="mt-3 text-sm text-muted">
            {t.settings.restoringABackupRequires2}
          </p>
        )}

        {/* Fehlerfall mit Begruendung statt eines wortlosen roten X. */}
        {importStatus === "error" && (
          <p className="mt-3 text-sm text-red-500">{importError || t.settings.importError}</p>
        )}
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
            {t.settings.deleteAccount}
          </h2>
        </div>
        <p className="text-sm text-faint mb-4">
          {t.settings.allYourDataWill}
        </p>
        <button
          onClick={() => setShowDeleteAccount(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          {t.settings.deleteAccountAndAll}
        </button>
      </Card>

      {/* Import Confirm Dialog */}
      <ConfirmDialog
        open={showImportConfirm}
        onClose={() => {
          setShowImportConfirm(false);
          setPendingImportFile(null);
        }}
        onConfirm={handleImportConfirm}
        title={t.settings.restoreBackup2}
        message={t.settings.allExistingDataOrders}
        confirmText={t.settings.restore}
        cancelText={t.common.cancel}
      />

      {/* Delete Account Dialog */}
      <ConfirmDialog
        open={showDeleteAccount}
        onClose={() => setShowDeleteAccount(false)}
        errorFallback={t.settings.failedToDeleteAccount}
        onConfirm={async () => {
          // Ein Fehler wird GEWORFEN, nicht in den Seitenzustand geschrieben:
          // Der Dialog zeigt ihn an und bleibt offen. Ein `return` galt ihm
          // als Erfolg — und ließ ihn eingefroren stehen.
          //
          // Geworfen wird der Fehlercode, nicht der Meldungstext des Servers:
          // den übersetzt der Dialog über `apiErrorMessage`, alles Unbekannte
          // wird zu `errorFallback`. "Unauthorized" im deutschen Dialog war
          // genau der Fall, den das verhindert.
          let res: Response;
          try {
            res = await fetch("/api/account", { method: "DELETE" });
          } catch {
            throw new Error("network");
          }
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            const err: Error & { code?: string } = new Error("account-delete-failed");
            err.code = typeof data.code === "string" ? data.code : undefined;
            throw err;
          }
          await clearLocalData({ deleteSalesQueue: true });
          await authClient.signOut();
          router.push("/auth/login");
        }}
        title={t.settings.deleteAccount}
        message={
          (t.settings.areYouSureAll)
        }
        confirmText={t.settings.deletePermanently}
        cancelText={t.common.cancel}
      />
    </div>
  );
}
