import { useState, useEffect, useRef } from "react";
import {
  Folder, FolderPlus, Image as ImageIcon, Film, FileText, FileSpreadsheet,
  Search, LayoutGrid, List, MoreVertical, Upload, HardDrive, Star, Clock,
  Trash2, Share2, Copy, Move, Info, X, Download, Play, Pause, Volume2,
  Maximize2, ChevronLeft, ChevronRight, Plus, Check, Users2, CheckCircle2,
  LogOut, Sun, Moon, Lock, ArrowLeft, Pin, HardDriveDownload, WifiOff, Mail, Loader2,
} from "lucide-react";

// ── Cognito config ──────────────────────────────────────────────
// Direct calls to Cognito's API instead of the AWS SDK, since this
// environment can't install npm packages. This is genuinely how the
// SDK works under the hood - real requests, real auth, no mocking.
const COGNITO_REGION = "eu-north-1";
const COGNITO_CLIENT_ID = "2ka2rugsemv1b1cf1url1jfci";
const COGNITO_ENDPOINT = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`;

async function cognitoRequest(target, body) {
  const res = await fetch(COGNITO_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || (data.__type ? data.__type.split("#").pop() : "Something went wrong"));
  }
  return data;
}

const cognitoSignUp = (email, password, name) =>
  cognitoRequest("SignUp", {
    ClientId: COGNITO_CLIENT_ID,
    Username: email,
    Password: password,
    UserAttributes: [
      { Name: "email", Value: email },
      { Name: "name", Value: name },
    ],
  });

const cognitoConfirmSignUp = (email, code) =>
  cognitoRequest("ConfirmSignUp", {
    ClientId: COGNITO_CLIENT_ID,
    Username: email,
    ConfirmationCode: code,
  });

const cognitoSignIn = (email, password) =>
  cognitoRequest("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: COGNITO_CLIENT_ID,
    AuthParameters: { USERNAME: email, PASSWORD: password },
  });

function decodeJWT(token) {
  try {
    const payload = token.split(".")[1];
    const json = decodeURIComponent(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return {};
  }
}

// ── API config ──────────────────────────────────────────────────
const API_BASE_URL = "https://1ge9plmm10.execute-api.eu-north-1.amazonaws.com";

async function apiRequest(method, path, token, body) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const THEME = {
  dark: {
    bgGradient: "from-zinc-950 via-black to-zinc-950",
    panelBg: "rgba(255,255,255,0.06)",
    cardBg: "rgba(255,255,255,0.05)",
    modalBg: "rgba(24,24,27,0.88)",
    menuBg: "rgba(40,40,46,0.4)",
    mobileBarBg: "rgba(10,10,10,0.9)",
    border: "border-white/10",
    borderHover: "hover:border-white/20",
    divider: "border-white/10",
    inputBg: "bg-black/25",
    textPrimary: "text-white",
    textSecondary: "text-zinc-300",
    textMuted: "text-zinc-500",
    textFaint: "text-zinc-600",
    hoverBg: "hover:bg-white/5",
    mediaGradient: "from-zinc-800 to-zinc-900",
    blobs: ["bg-orange-600/25", "bg-orange-500/20", "bg-amber-500/10"],
    placeholderText: "text-zinc-600",
    dotColor: "rgba(255,255,255,0.07)",
    solidBg: "#18181b",
    tiltBg: "rgba(30,30,33,0.65)",
  },
  light: {
    bgGradient: "from-orange-50 via-white to-zinc-100",
    panelBg: "rgba(255,255,255,0.6)",
    cardBg: "rgba(255,255,255,0.75)",
    modalBg: "rgba(255,255,255,0.92)",
    menuBg: "rgba(255,255,255,0.5)",
    mobileBarBg: "rgba(255,255,255,0.9)",
    border: "border-black/10",
    borderHover: "hover:border-black/20",
    divider: "border-black/10",
    inputBg: "bg-black/5",
    textPrimary: "text-zinc-900",
    textSecondary: "text-zinc-600",
    textMuted: "text-zinc-500",
    textFaint: "text-zinc-400",
    hoverBg: "hover:bg-black/5",
    mediaGradient: "from-zinc-200 to-zinc-100",
    blobs: ["bg-orange-400/20", "bg-orange-300/20", "bg-amber-300/10"],
    placeholderText: "text-zinc-400",
    dotColor: "rgba(0,0,0,0.08)",
    solidBg: "#ffffff",
    tiltBg: "rgba(255,255,255,0.75)",
  },
};

const TYPES = {
  folder: { icon: Folder, kind: "icon" },
  pdf: { icon: FileText, kind: "icon" },
  doc: { icon: FileText, kind: "icon" },
  sheet: { icon: FileSpreadsheet, kind: "icon" },
  image: { icon: ImageIcon, kind: "media" },
  video: { icon: Film, kind: "media" },
};

const NAV = [
  { id: "files", label: "My Files", icon: HardDrive },
  { id: "shared", label: "Shared", icon: Users2 },
  { id: "recent", label: "Recent", icon: Clock },
  { id: "starred", label: "Starred", icon: Star },
  { id: "trash", label: "Trash", icon: Trash2 },
];

const VAULT_FILES = [
  { id: "vp1", type: "pdf", name: "passport-scan.pdf", size: "3.1 MB", uploaded: "Jun 2, 2026 · 10:15" },
  { id: "vp2", type: "doc", name: "seaman-card-backup.docx", size: "88 KB", uploaded: "May 18, 2026 · 19:40" },
  { id: "vp3", type: "image", name: "id-photo.jpg", size: "1.8 MB", uploaded: "May 18, 2026 · 19:41" },
];

const BADGE_STYLES = {
  green: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
  red: "bg-red-500/10 border-red-500/30 text-red-400",
  amber: "bg-amber-500/10 border-amber-500/30 text-amber-400",
  orange: "bg-orange-500/10 border-orange-500/30 text-orange-400",
  blue: "bg-cyan-500/10 border-cyan-500/30 text-cyan-400",
};

function Badge({ color, icon: Icon, label }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border liquid-glass text-xs font-medium ${BADGE_STYLES[color]}`}>
      <Icon size={11} /> {label}
    </span>
  );
}

export default function CloudStorageApp() {
  const [theme, setTheme] = useState("dark");
  const d = THEME[theme];
  const [authUser, setAuthUser] = useState(null);
  const userInitials = authUser?.name
    ? authUser.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [view, setView] = useState("grid");
  const [activeNav, setActiveNav] = useState("files");
  const [menu, setMenu] = useState(null);
  const [details, setDetails] = useState(null);
  const [accountView, setAccountView] = useState(false);
  const [pinnedIds, setPinnedIds] = useState(new Set());
  const [offlineIds, setOfflineIds] = useState(new Set());
  const [shareItem, setShareItem] = useState(null);
  const [zippingName, setZippingName] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [viewer, setViewer] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [uploadMinimized, setUploadMinimized] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [newMenuPos, setNewMenuPos] = useState(null);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [videoPlaying, setVideoPlaying] = useState(false);
  const fileInputRef = useRef(null);
  const folderNameRef = useRef(null);

  // Hidden vault (secret entry: tap the logo 5x quickly)
  const [logoTaps, setLogoTaps] = useState(0);
  const [vaultPromptOpen, setVaultPromptOpen] = useState(false);
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [vaultPin, setVaultPin] = useState("");
  const [vaultError, setVaultError] = useState(false);
  const tapTimerRef = useRef(null);
  const vaultPinRef = useRef(null);
  const VAULT_PIN = "2468"; // demo only — real version stores this hashed server-side

  const handleLogoTap = () => {
    setLogoTaps((n) => {
      const next = n + 1;
      if (next >= 5) {
        setVaultPromptOpen(true);
        return 0;
      }
      return next;
    });
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => setLogoTaps(0), 1200);
  };

  useEffect(() => {
    if (vaultPromptOpen) {
      setVaultPin("");
      setVaultError(false);
      setTimeout(() => vaultPinRef.current?.focus(), 50);
    }
  }, [vaultPromptOpen]);

  const submitVaultPin = () => {
    if (vaultPin === VAULT_PIN) {
      setVaultUnlocked(true);
      setVaultPromptOpen(false);
    } else {
      setVaultError(true);
      setVaultPin("");
    }
  };

  const q = searchQuery.trim().toLowerCase();
  const filteredFolders = q ? folders.filter((f) => f.name.toLowerCase().includes(q)) : folders;
  const filteredFiles = q ? files.filter((f) => f.name.toLowerCase().includes(q)) : files;
  const items = [...filteredFolders, ...filteredFiles];
  const imageItems = files.filter((f) => f.type === "image");
  const noResults = q && filteredFolders.length === 0 && filteredFiles.length === 0;
  const pinnedItems = [...folders, ...files].filter((i) => pinnedIds.has(i.id));

  useEffect(() => {
    if (folderModalOpen) folderNameRef.current?.focus();
  }, [folderModalOpen]);

  useEffect(() => {
    const closeMenu = () => setMenu(null);
    window.addEventListener("scroll", closeMenu, true);
    return () => window.removeEventListener("scroll", closeMenu, true);
  }, []);

  useEffect(() => {
    if (uploads.length === 0) return;
    const interval = setInterval(() => {
      setUploads((prev) =>
        prev.map((u) => (u.progress >= 100 ? u : { ...u, progress: Math.min(100, u.progress + Math.random() * 18 + 6) }))
      );
    }, 350);
    return () => clearInterval(interval);
  }, [uploads.length]);

  const handleFileSelect = (e) => {
    const pickedFiles = Array.from(e.target.files || []);
    if (pickedFiles.length === 0) return;
    setUploadMinimized(false);
    pickedFiles.forEach((file) => realUpload(file));
    e.target.value = "";
  };

  const confirmNewFolder = async () => {
    const name = newFolderName.trim();
    setFolderModalOpen(false);
    setNewFolderName("");
    if (!name) return;
    try {
      await realCreateFolder(name);
    } catch (err) {
      alert(`Could not create folder: ${err.message}`);
    }
  };

  const openNewMenu = (e, align = "left") => {
    const r = e.currentTarget.getBoundingClientRect();
    const menuWidth = 208;
    const x = align === "right" ? r.right - menuWidth : r.left;
    setNewMenuPos({ x: Math.max(8, Math.min(x, window.innerWidth - menuWidth - 8)), y: r.bottom + 6, width: r.width });
    setNewMenuOpen(true);
  };

  // ── Real backend integration ────────────────────────────────
  const fetchItems = async () => {
    setItemsLoading(true);
    setItemsError("");
    try {
      const data = await apiRequest("GET", "/items", authUser.idToken);
      const allItems = data.items || [];
      setFolders(
        allItems
          .filter((i) => i.type === "folder")
          .map((i) => ({ ...i, id: i.itemId, meta: i.createdAt ? new Date(i.createdAt).toLocaleDateString() : "" }))
      );
      setFiles(
        allItems
          .filter((i) => i.type !== "folder")
          .map((i) => ({
            ...i,
            id: i.itemId,
            sizeBytes: i.size || 0,
            size: i.size ? `${(i.size / 1024 / 1024).toFixed(1)} MB` : "—",
            uploaded: i.createdAt ? new Date(i.createdAt).toLocaleString() : "",
          }))
      );
    } catch (err) {
      setItemsError(err.message);
    } finally {
      setItemsLoading(false);
    }
  };

  useEffect(() => {
    if (authUser) fetchItems();
  }, [authUser]);

  const realCreateFolder = async (name) => {
    const data = await apiRequest("POST", "/folders", authUser.idToken, { name });
    setFolders((prev) => [{ ...data.item, id: data.item.itemId, meta: "just now" }, ...prev]);
  };

  const realUpload = async (file) => {
    const uploadId = "u" + Date.now() + Math.random();
    setUploads((prev) => [...prev, { id: uploadId, name: file.name, progress: 0 }]);
    try {
      const { uploadUrl, item } = await apiRequest("POST", "/upload-url", authUser.idToken, {
        fileName: file.name,
        fileType: file.type,
        size: file.size,
      });

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setUploads((prev) => prev.map((u) => (u.id === uploadId ? { ...u, progress: pct } : u)));
          }
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed")));
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(file);
      });

      setUploads((prev) => prev.map((u) => (u.id === uploadId ? { ...u, progress: 100 } : u)));
      setFiles((prev) => [
        { ...item, id: item.itemId, sizeBytes: file.size, size: `${(file.size / 1024 / 1024).toFixed(1)} MB`, uploaded: "just now" },
        ...prev,
      ]);
    } catch (err) {
      setUploads((prev) => prev.filter((u) => u.id !== uploadId));
      alert(`Upload failed: ${err.message}`);
    }
  };

  const realDownload = async (item) => {
    try {
      const data = await apiRequest("GET", `/download-url/${item.itemId || item.id}`, authUser.idToken);
      // Fetch the real bytes ourselves rather than linking straight to S3 - browsers
      // don't reliably force-download cross-origin links, but a same-origin blob
      // URL always triggers a real download regardless of browser quirks.
      const fileRes = await fetch(data.downloadUrl);
      if (!fileRes.ok) throw new Error("Could not fetch file");
      const blob = await fileRes.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = data.name || item.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    }
  };

  const realDelete = async (item) => {
    try {
      await apiRequest("DELETE", `/items/${item.itemId || item.id}`, authUser.idToken);
      if (item.type === "folder") setFolders((prev) => prev.filter((f) => f.id !== item.id && f.itemId !== item.itemId));
      else setFiles((prev) => prev.filter((f) => f.id !== item.id && f.itemId !== item.itemId));
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const goToNav = (id) => {
    setActiveNav(id);
    setAccountView(false);
    setVaultUnlocked(false);
    setMobileNavOpen(false);
  };

  const totalStorageBytes = files.reduce((sum, f) => sum + (f.sizeBytes || 0), 0);
  const totalStorageGB = (totalStorageBytes / 1024 / 1024 / 1024).toFixed(2);

  const togglePin = (item) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  };

  const toggleOffline = (item) => {
    setOfflineIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  };

  const openMenuAt = (x, y, item) => {
    const menuWidth = 208;
    const menuHeight = 264;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let mx = Math.max(8, Math.min(x, vw - menuWidth - 8));
    let my = y;
    if (my + menuHeight > vh - 8) my = Math.max(8, my - menuHeight - 40);
    setMenu({ item, x: mx, y: my });
  };

  const pressTimerRef = useRef(null);
  const longPressFiredRef = useRef(false);

  const handlePressStart = (e, item) => {
    longPressFiredRef.current = false;
    const point = e.touches?.[0] ?? e;
    const x = point.clientX ?? 0;
    const y = point.clientY ?? 0;
    pressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      if (navigator.vibrate) navigator.vibrate(12);
      openMenuAt(x - 190, y + 10, item);
    }, 480);
  };

  const handlePressEnd = () => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
  };

  const handlePressClick = (fn) => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    fn();
  };

  const openMenu = (e, item) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    openMenuAt(r.right - 208, r.bottom + 6, item);
  };

  const makeShareLink = (item) => {
    const slug = item.id.replace(/[^a-z0-9]/gi, "") + Math.random().toString(36).slice(2, 8);
    return `https://ethix.cloud/s/${slug}`;
  };

  const openShare = (item) => {
    setShareItem({ ...item, link: makeShareLink(item) });
    setLinkCopied(false);
  };

  const copyShareLink = () => {
    if (!shareItem) return;
    navigator.clipboard?.writeText(shareItem.link).catch(() => {});
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const triggerBlobDownload = (filename, content, mime) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDownload = (item) => {
    if (item.type === "folder") {
      // Folder zip-download needs a dedicated Lambda (zips S3 objects server-side) - not built yet.
      // Still simulated here so the UX is visible; wire this up once that Lambda exists.
      setZippingName(item.name);
      setTimeout(() => {
        triggerBlobDownload(`${item.name}.zip`, `Placeholder zip contents for ${item.name}`, "application/zip");
        setZippingName(null);
      }, 1400);
    } else {
      realDownload(item);
    }
  };

  const openItem = (item) => {
    if (item.type === "image") setViewer({ type: "image", item, index: imageItems.findIndex((f) => f.id === item.id) });
    else if (item.type === "video") { setVideoPlaying(false); setViewer({ type: "video", item }); }
    else if (item.type === "pdf") setViewer({ type: "pdf", item });
  };

  const activeUploads = uploads.filter((u) => u.progress < 100).length;
  const currentPageLabel = NAV.find((n) => n.id === activeNav)?.label || "My Files";

  if (!authUser) {
    return <LoginScreen d={d} theme={theme} setTheme={setTheme} onLogin={setAuthUser} />;
  }

  return (
    <div className={`app-root relative min-h-screen w-full overflow-hidden bg-gradient-to-br ${d.bgGradient} font-sans ${d.textPrimary} transition-colors duration-300`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        .font-sans { font-family: 'Inter', system-ui, sans-serif; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { scrollbar-width: none; }
        .app-root, .app-root * {
          -webkit-user-select: none;
          -moz-user-select: none;
          user-select: none;
          -webkit-touch-callout: none;
        }
        .app-root input, .app-root textarea {
          -webkit-user-select: text;
          -moz-user-select: text;
          user-select: text;
        }
        .liquid-glass { backdrop-filter: blur(28px) saturate(180%); -webkit-backdrop-filter: blur(28px) saturate(180%); }
        .glass-sheen::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(120deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0.05) 30%, rgba(255,255,255,0) 55%, rgba(255,255,255,0.16) 100%);
          box-shadow: inset 0 1px 1px rgba(255,255,255,0.4), inset 0 -12px 20px -14px rgba(0,0,0,0.35);
          pointer-events: none;
        }
        .glass-sheen > * { position: relative; z-index: 1; }
        @keyframes dropdownIn { from { opacity: 0; transform: scale(0.94) translateY(-6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .dropdown-anim { animation: dropdownIn 380ms cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.94) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .modal-anim { animation: modalIn 220ms cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .fade-in { animation: fadeIn 200ms ease; }
        @keyframes floatA { 0%,100% { transform: translate(0,0); } 50% { transform: translate(50px,-30px); } }
        @keyframes floatB { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-40px,40px); } }
        @keyframes floatC { 0%,100% { transform: translate(0,0); } 50% { transform: translate(30px,30px); } }
        .blob-a { animation: floatA 24s ease-in-out infinite; }
        .blob-b { animation: floatB 28s ease-in-out infinite; }
        .blob-c { animation: floatC 20s ease-in-out infinite; }
        @keyframes pulseGlow { 0%,100% { box-shadow: 0 0 0 0 rgba(249,115,22,0.45); } 50% { box-shadow: 0 0 14px 5px rgba(249,115,22,0.45); } }
        .logo-pulse { animation: pulseGlow 2.6s ease-in-out infinite; }
        @keyframes beamSpin { to { transform: rotate(360deg); } }
        .beam-spin { animation: beamSpin 4s linear infinite; }
      `}</style>

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{ backgroundImage: `radial-gradient(${d.dotColor} 1px, transparent 1px)`, backgroundSize: "24px 24px" }}
        />
        <div className={`blob-a absolute -top-24 -left-20 w-96 h-96 rounded-full ${d.blobs[0]} blur-3xl`} />
        <div className={`blob-b absolute top-1/3 -right-24 w-96 h-96 rounded-full ${d.blobs[1]} blur-3xl`} />
        <div className={`blob-c absolute -bottom-20 left-1/3 w-96 h-96 rounded-full ${d.blobs[2]} blur-3xl`} />
      </div>

      <div className="relative z-10 flex h-screen gap-4 p-4">
        <aside
          className={`hidden md:flex w-64 shrink-0 flex-col rounded-2xl p-4 liquid-glass relative glass-sheen border ${d.border} shadow-xl shadow-black/40`}
          style={{ background: d.panelBg }}
        >
          <div className="flex items-center gap-2.5 px-2 pt-1 pb-6 select-none cursor-pointer" onClick={handleLogoTap}>
            <span className={`text-base font-extrabold tracking-tight ${d.textPrimary}`}>ethix<span className="text-orange-400">.cloud</span></span>
          </div>

          <div className="relative mb-5">
            <button
              onClick={(e) => openNewMenu(e, "left")}
              className="relative glass-sheen overflow-hidden w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold bg-orange-500 text-black shadow-lg shadow-orange-500/20 transition hover:bg-orange-400 active:scale-95"
            >
              <Plus size={16} /> New
            </button>
          </div>

          <p className={`px-3 text-xs uppercase tracking-wider ${d.textMuted} font-semibold mb-2`}>Navigation</p>
          <nav className="flex flex-col gap-1 flex-1">
            {NAV.map((n) => {
              const Icon = n.icon;
              const active = activeNav === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => goToNav(n.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition active:scale-95 border-l-2 ${
                    active
                      ? "bg-orange-500/10 border-orange-500 text-orange-400 font-medium"
                      : `border-transparent ${d.textMuted} hover:text-orange-400 ${d.hoverBg}`
                  }`}
                >
                  <Icon size={17} strokeWidth={2} />
                  {n.label}
                </button>
              );
            })}
          </nav>

          {/* Theme toggle */}
          <div className="flex items-center justify-between px-1 mb-4">
            <p className={`text-xs uppercase tracking-wider ${d.textMuted} font-semibold`}>Theme</p>
            <ThemeToggle theme={theme} setTheme={setTheme} d={d} />
          </div>

          {/* Storage */}
          <div className="mt-2">
            <div className="flex items-center justify-between px-1 mb-2">
              <p className={`text-xs uppercase tracking-wider ${d.textMuted} font-semibold`}>Storage</p>
              <span className={`text-xs ${d.textMuted} font-mono`}>{totalStorageGB} GB</span>
            </div>
            <div className={`w-full h-2 rounded-full overflow-hidden ${d.inputBg} border ${d.border}`}>
              <div className="h-full rounded-full bg-gradient-to-r from-orange-600 to-orange-400" style={{ width: `${Math.min(100, (totalStorageBytes / (5 * 1024 * 1024 * 1024)) * 100)}%` }} />
            </div>
          </div>

          {/* Account / logout */}
          <div className={`mt-4 pt-3 border-t ${d.divider} flex items-center gap-2.5`}>
            <button onClick={() => setAccountView(true)} className="active:scale-95 transition flex items-center gap-2.5 min-w-0 flex-1 text-left">
              <div className="relative glass-sheen overflow-hidden w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-orange-500 text-black shrink-0">
                {userInitials}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${d.textPrimary} truncate`}>{authUser.name}</p>
                <p className={`text-xs ${d.textMuted} truncate`}>{authUser.email}</p>
              </div>
            </button>
            <button onClick={() => setAuthUser(null)} className={`p-1.5 rounded-lg ${d.textMuted} hover:text-red-400 hover:bg-red-500/10 transition shrink-0`} title="Log out">
              <LogOut size={16} />
            </button>
          </div>
          <p className={`text-center text-xs mt-3 ${d.textFaint}`}>Created by Sohel</p>
        </aside>

        <main
          className={`flex-1 flex flex-col overflow-hidden rounded-2xl liquid-glass relative glass-sheen border ${d.border} shadow-xl shadow-black/40`}
          style={{ background: d.panelBg }}
        >
          <div className={`flex items-center gap-4 px-6 py-4 border-b ${d.divider}`}>
            <div className="md:hidden flex flex-col leading-tight select-none cursor-pointer" onClick={handleLogoTap}>
              <span className={`text-xs font-extrabold tracking-tight ${d.textPrimary}`}>ethix<span className="text-orange-400">.cloud</span></span>
              <span className={`text-xs ${d.textMuted}`}>{currentPageLabel}</span>
            </div>
            <div className={`hidden sm:flex items-center gap-2 flex-1 max-w-md rounded-xl px-4 py-2 ${d.inputBg} liquid-glass border ${d.border}`}>
              <Search size={16} className={d.textMuted} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your files"
                className={`bg-transparent outline-none text-sm w-full ${d.textPrimary} placeholder-zinc-500`}
              />
            </div>
            <div className={`hidden md:flex items-center gap-1 rounded-full p-1 ${d.inputBg} liquid-glass border ${d.border}`}>
              <button onClick={() => setView("grid")} className={`p-1.5 rounded-full transition ${view === "grid" ? "bg-orange-500/20 text-orange-400" : d.textMuted}`}>
                <LayoutGrid size={16} />
              </button>
              <button onClick={() => setView("list")} className={`p-1.5 rounded-full transition ${view === "list" ? "bg-orange-500/20 text-orange-400" : d.textMuted}`}>
                <List size={16} />
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            {!accountView && (
              <div className="sm:hidden flex items-center gap-2 ml-auto relative">
                <div className="flex items-center">
                  {mobileSearchOpen ? (
                    <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${d.inputBg} liquid-glass border ${d.border} transition-all duration-300`} style={{ width: "40vw" }}>
                      <Search size={15} className={d.textMuted} />
                      <input
                        autoFocus
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search..."
                        className={`bg-transparent outline-none text-sm w-full ${d.textPrimary} placeholder-zinc-500`}
                      />
                      <button onClick={() => { setMobileSearchOpen(false); setSearchQuery(""); }} className={d.textMuted}>
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setMobileSearchOpen(true)}
                      className={`p-2.5 rounded-xl ${d.inputBg} liquid-glass border ${d.border} ${d.textMuted} transition`}
                    >
                      <Search size={16} />
                    </button>
                  )}
                </div>

                <div className={`${mobileSearchOpen ? "hidden" : "flex"} items-center gap-2 relative`}>
                  <button
                    onClick={(e) => openNewMenu(e, "right")}
                    className="relative glass-sheen overflow-hidden flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold bg-orange-500 text-black shadow-lg shadow-orange-500/20 transition hover:bg-orange-400"
                  >
                    <Plus size={16} /> New
                  </button>
                </div>
              </div>
            )}
            <button
              onClick={() => setMobileNavOpen(true)}
              className={`active:scale-90 md:hidden ${accountView ? "ml-auto" : ""} p-2 rounded-xl ${d.inputBg} liquid-glass border ${d.border} ${d.textMuted}`}
            >
              <MoreVertical size={18} />
            </button>
            <button onClick={() => setAccountView(true)} className="active:scale-95 transition relative glass-sheen overflow-hidden hidden md:flex w-9 h-9 rounded-full items-center justify-center text-xs font-bold bg-orange-500 text-black shrink-0 transition hover:brightness-110">
              {userInitials}
            </button>
          </div>

          <div className="flex items-center justify-between px-6 py-4">
            <h1 className={`hidden md:block text-xl font-bold ${d.textPrimary}`}>{accountView ? "Your Account" : "My Files"}</h1>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-6">
            {itemsLoading ? (
              <div className="flex flex-col items-center justify-center py-24">
                <Loader2 size={24} className={`animate-spin ${d.textMuted} mb-3`} />
                <p className={`text-sm ${d.textMuted}`}>Loading your files…</p>
              </div>
            ) : itemsError ? (
              <div className="flex flex-col items-center justify-center py-24">
                <p className="text-sm text-red-400 mb-3">Could not load files: {itemsError}</p>
                <button onClick={fetchItems} className="text-xs rounded-lg px-3 py-1.5 bg-orange-500/10 border border-orange-500/30 text-orange-400">
                  Try again
                </button>
              </div>
            ) : accountView ? (
              <AccountPage d={d} theme={theme} onBack={() => setAccountView(false)} authUser={authUser} userInitials={userInitials} onLogout={() => setAuthUser(null)} totalStorageGB={totalStorageGB} />
            ) : vaultUnlocked ? (
              <>
                <button
                  onClick={() => setVaultUnlocked(false)}
                  className={`flex items-center gap-2 text-sm mb-4 ${d.textSecondary} hover:text-orange-400 transition`}
                >
                  <ArrowLeft size={15} /> Back to My Files
                </button>
                <div className="flex items-center gap-2 mb-4">
                  <Lock size={14} className="text-orange-400" />
                  <p className={`text-xs uppercase tracking-wider ${d.textMuted} font-semibold`}>Private</p>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {VAULT_FILES.map((item) => {
                    const meta = TYPES[item.type] || TYPES.doc;
                    const Icon = meta.icon;
                    const isMedia = meta.kind === "media";
                    return (
                      <div
                        key={item.id}
                        className={`rounded-xl overflow-hidden border ${d.border} liquid-glass`}
                        style={{ background: d.cardBg }}
                      >
                        {isMedia ? (
                          <div className={`h-14 flex items-center justify-center relative bg-gradient-to-br ${d.mediaGradient}`}>
                            <Icon size={18} className={d.placeholderText} />
                          </div>
                        ) : (
                          <div className="h-14 flex items-center justify-center bg-orange-500/10">
                            <Icon size={18} className="text-orange-400" />
                          </div>
                        )}
                        <div className="p-2">
                          <p className={`text-xs font-medium truncate ${d.textPrimary}`}>{item.name}</p>
                          <p className={`text-xs mt-0.5 truncate ${d.textMuted} font-mono`}>{item.size}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : view === "grid" ? (
              <>
                {pinnedItems.length > 0 && !q && (
                  <div className="mb-6">
                    <p className={`text-xs uppercase tracking-wider ${d.textMuted} font-semibold mb-3 flex items-center gap-1.5`}>
                      <Pin size={11} className="text-orange-400" /> Pinned
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                      {pinnedItems.map((item) => {
                        const meta = TYPES[item.type] || TYPES.doc;
                        const Icon = meta.icon;
                        return (
                          <div
                            key={item.id}
                            onClick={() => handlePressClick(() => openItem(item))}
                            onTouchStart={(e) => handlePressStart(e, item)}
                            onTouchEnd={handlePressEnd}
                            onTouchMove={handlePressEnd}
                            onMouseDown={(e) => handlePressStart(e, item)}
                            onMouseUp={handlePressEnd}
                            onContextMenu={(e) => e.preventDefault()}
                            className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition cursor-pointer group relative border ${d.border} liquid-glass ${d.borderHover}`}
                            style={{ background: d.cardBg }}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.kind === "media" ? `bg-gradient-to-br ${d.mediaGradient}` : "bg-orange-500/10"}`}>
                              <Icon size={16} className={meta.kind === "media" ? d.placeholderText : "text-orange-400"} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm font-medium truncate ${d.textPrimary}`}>{item.name}</p>
                              <p className={`text-xs truncate ${d.textMuted} font-mono`}>{item.meta || item.size}</p>
                            </div>
                            <Pin size={12} className="text-orange-400 shrink-0 fill-orange-400" />
                            <button
                              onClick={(e) => openMenu(e, item)}
                              className={`active:scale-90 p-1 rounded-full opacity-0 group-hover:opacity-100 transition ${d.textMuted} hover:text-orange-400 shrink-0`}
                            >
                              <MoreVertical size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {filteredFolders.length > 0 && (
                  <div className="mb-6">
                    <p className={`text-xs uppercase tracking-wider ${d.textMuted} font-semibold mb-3`}>Folders</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                      {filteredFolders.map((item) => (
                        <TiltCard
                          key={item.id}
                          onClick={() => openItem(item)}
                          onLongPress={(x, y) => openMenuAt(x - 190, y + 10, item)}
                          className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition cursor-pointer group relative border ${d.border} ${d.borderHover}`}
                          style={{ background: d.tiltBg }}
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-orange-500/10">
                            <Folder size={16} className="text-orange-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-medium truncate ${d.textPrimary}`}>{item.name}</p>
                            <p className={`text-xs truncate ${d.textMuted} font-mono`}>{item.meta}</p>
                          </div>
                          {pinnedIds.has(item.id) && <Pin size={12} className="text-orange-400 shrink-0 fill-orange-400" />}
                          {offlineIds.has(item.id) && <HardDriveDownload size={12} className="text-emerald-400 shrink-0" />}
                          <button
                            onClick={(e) => openMenu(e, item)}
                            className={`active:scale-90 p-1 rounded-full opacity-0 group-hover:opacity-100 transition ${d.textMuted} hover:text-orange-400 shrink-0`}
                          >
                            <MoreVertical size={14} />
                          </button>
                        </TiltCard>
                      ))}
                    </div>
                  </div>
                )}

                {(filteredFiles.length > 0 || !q) && (
                  <>
                    <p className={`text-xs uppercase tracking-wider ${d.textMuted} font-semibold mb-3`}>Files</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {filteredFiles.map((item) => {
                  const meta = TYPES[item.type] || TYPES.doc;
                  const Icon = meta.icon;
                  const isMedia = meta.kind === "media";
                  return (
                    <TiltCard
                      key={item.id}
                      onClick={() => openItem(item)}
                      onLongPress={(x, y) => openMenuAt(x - 190, y + 10, item)}
                      className={`rounded-xl overflow-hidden transition cursor-pointer group relative border ${d.border} ${d.borderHover}`}
                      style={{ background: d.tiltBg }}
                    >
                      <button
                        onClick={(e) => openMenu(e, item)}
                        className="active:scale-90 absolute top-1.5 right-1.5 z-10 p-1 rounded-full opacity-0 group-hover:opacity-100 transition bg-black/40 text-zinc-200 hover:bg-black/60"
                      >
                        <MoreVertical size={13} />
                      </button>
                      {pinnedIds.has(item.id) && (
                        <div className="absolute top-1.5 left-1.5 z-10 p-1 rounded-full bg-black/40">
                          <Pin size={11} className="text-orange-400 fill-orange-400" />
                        </div>
                      )}
                      {offlineIds.has(item.id) && (
                        <div className="absolute bottom-1.5 left-1.5 z-10 p-1 rounded-full bg-black/40">
                          <HardDriveDownload size={11} className="text-emerald-400" />
                        </div>
                      )}
                      {isMedia ? (
                        <div className={`h-14 flex items-center justify-center relative bg-gradient-to-br ${d.mediaGradient}`}>
                          {item.type === "video" ? (
                            <div className="w-7 h-7 rounded-full flex items-center justify-center bg-orange-500 shadow-lg shadow-orange-500/20">
                              <Play size={12} className="text-black ml-0.5" fill="black" />
                            </div>
                          ) : (
                            <Icon size={18} className={d.placeholderText} />
                          )}
                        </div>
                      ) : (
                        <div className="h-14 flex items-center justify-center bg-orange-500/10">
                          <Icon size={18} className="text-orange-400" />
                        </div>
                      )}
                      <div className="p-2">
                        <p className={`text-xs font-medium truncate ${d.textPrimary}`}>{item.name}</p>
                        <p className={`text-xs mt-0.5 truncate ${d.textMuted} font-mono`}>{item.size}</p>
                      </div>
                    </TiltCard>
                  );
                    })}
                    </div>
                  </>
                )}

                {noResults && (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Search size={28} className={d.textFaint} />
                    <p className={`text-sm mt-3 ${d.textMuted}`}>No files or folders match "{searchQuery}"</p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col gap-1">
                {items.map((item) => {
                  const meta = TYPES[item.type] || TYPES.doc;
                  const Icon = meta.icon;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handlePressClick(() => openItem(item))}
                      onTouchStart={(e) => handlePressStart(e, item)}
                      onTouchEnd={handlePressEnd}
                      onTouchMove={handlePressEnd}
                      onMouseDown={(e) => handlePressStart(e, item)}
                      onMouseUp={handlePressEnd}
                      onContextMenu={(e) => e.preventDefault()}
                      className={`flex items-center gap-4 px-3 py-2.5 rounded-xl transition cursor-pointer group ${d.hoverBg}`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${meta.kind === "media" ? `bg-gradient-to-br ${d.mediaGradient}` : "bg-orange-500/10"}`}>
                        <Icon size={16} className={meta.kind === "media" ? d.placeholderText : "text-orange-400"} />
                      </div>
                      <p className={`text-sm flex-1 truncate ${d.textPrimary}`}>{item.name}</p>
                      {pinnedIds.has(item.id) && <Pin size={12} className="text-orange-400 fill-orange-400 shrink-0" />}
                      {offlineIds.has(item.id) && <HardDriveDownload size={12} className="text-emerald-400 shrink-0" />}
                      {item.type !== "folder" && <Badge color="green" icon={CheckCircle2} label="Synced" />}
                      <p className={`text-xs font-mono w-36 truncate ${d.textMuted} hidden sm:block`}>{item.meta ? item.meta.split(" · ")[1] : item.uploaded}</p>
                      <p className={`text-xs font-mono w-16 text-right ${d.textMuted} hidden sm:block`}>{item.size || "—"}</p>
                      <button onClick={(e) => openMenu(e, item)} className={`active:scale-90 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition ${d.textMuted} hover:text-orange-400`}>
                        <MoreVertical size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Mobile nav drawer backdrop */}
      <div
        className="md:hidden fixed inset-0 z-40 transition-opacity duration-500"
        style={{
          background: "rgba(0,0,0,0.5)",
          backdropFilter: mobileNavOpen ? "blur(6px)" : "blur(0px)",
          WebkitBackdropFilter: mobileNavOpen ? "blur(6px)" : "blur(0px)",
          opacity: mobileNavOpen ? 1 : 0,
          pointerEvents: mobileNavOpen ? "auto" : "none",
        }}
        onClick={() => setMobileNavOpen(false)}
      />

      {/* Mobile nav drawer panel */}
      <div
        className="md:hidden fixed top-0 right-0 z-50 h-full w-64 p-4 flex flex-col liquid-glass border-l"
        style={{
          background: d.panelBg,
          borderColor: d.border.includes("white") ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
          transform: mobileNavOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 480ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <span className={`text-sm font-extrabold tracking-tight ${d.textPrimary}`}>ethix<span className="text-orange-400">.cloud</span></span>
          <button onClick={() => setMobileNavOpen(false)} className={`${d.textMuted} active:scale-90 transition`}>
            <X size={18} />
          </button>
        </div>
        <p className={`text-xs uppercase tracking-wider ${d.textMuted} font-semibold mb-2`}>Navigation</p>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = activeNav === n.id;
            return (
              <button
                key={n.id}
                onClick={() => goToNav(n.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition active:scale-95 border-l-2 ${
                  active
                    ? "bg-orange-500/10 border-orange-500 text-orange-400 font-medium"
                    : `border-transparent ${d.textMuted} hover:text-orange-400 ${d.hoverBg}`
                }`}
              >
                <Icon size={17} strokeWidth={2} />
                {n.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center justify-between px-1 mt-6 mb-2">
          <p className={`text-xs uppercase tracking-wider ${d.textMuted} font-semibold`}>Theme</p>
          <ThemeToggle theme={theme} setTheme={setTheme} d={d} />
        </div>

        <button
          onClick={() => { setAccountView(true); setMobileNavOpen(false); }}
          className={`flex items-center gap-2.5 mt-auto pt-4 border-t ${d.divider} text-left transition active:scale-95`}
        >
          <div className="relative glass-sheen overflow-hidden w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-orange-500 text-black shrink-0">
            {userInitials}
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium ${d.textPrimary} truncate`}>{authUser.name}</p>
            <p className={`text-xs ${d.textMuted} truncate`}>{authUser.email}</p>
          </div>
        </button>
        <p className={`text-center text-xs mt-3 ${d.textFaint}`}>Created by Sohel</p>
      </div>

      {newMenuOpen && newMenuPos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setNewMenuOpen(false)} />
          <div
            className={`fixed z-50 rounded-2xl py-2 w-52 text-sm overflow-hidden liquid-glass dropdown-anim border ${d.border} shadow-xl shadow-black/40`}
            style={{ top: newMenuPos.y, left: newMenuPos.x, background: d.menuBg, backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)" }}
          >
            <button
              onClick={() => { setNewMenuOpen(false); fileInputRef.current?.click(); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition active:scale-95 ${d.textSecondary} ${d.hoverBg}`}
            >
              <Upload size={15} /> New Upload
            </button>
            <button
              onClick={() => { setNewMenuOpen(false); setFolderModalOpen(true); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition active:scale-95 ${d.textSecondary} ${d.hoverBg}`}
            >
              <FolderPlus size={15} /> New Folder
            </button>
          </div>
        </>
      )}

      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
          <div
            className={`fixed z-50 rounded-2xl py-2 w-52 text-sm overflow-hidden liquid-glass dropdown-anim border ${d.border} shadow-xl shadow-black/40`}
            style={{ top: menu.y, left: menu.x, background: d.menuBg, backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)" }}
          >
            <MenuItem icon={Info} label="Details" d={d} onClick={() => { setDetails(menu.item); setMenu(null); }} />
            <MenuItem
              icon={Pin}
              label={pinnedIds.has(menu.item.id) ? "Unpin" : "Pin"}
              d={d}
              onClick={() => { togglePin(menu.item); setMenu(null); }}
            />
            <MenuItem
              icon={HardDriveDownload}
              label={offlineIds.has(menu.item.id) ? "Remove from offline" : "Make available offline"}
              d={d}
              onClick={() => { toggleOffline(menu.item); setMenu(null); }}
            />
            <MenuItem
              icon={Download}
              label={menu.item.type === "folder" ? "Download as .zip" : "Download"}
              d={d}
              onClick={() => { handleDownload(menu.item); setMenu(null); }}
            />
            <MenuItem icon={Copy} label="Copy" d={d} onClick={() => setMenu(null)} />
            <MenuItem icon={Move} label="Move" d={d} onClick={() => setMenu(null)} />
            <MenuItem icon={Share2} label="Copy shareable link" d={d} onClick={() => { openShare(menu.item); setMenu(null); }} />
            <div className={`h-px my-1 mx-2 ${d.divider} border-t`} />
            <MenuItem icon={Trash2} label="Delete" d={d} danger onClick={() => { realDelete(menu.item); setMenu(null); }} />
          </div>
        </>
      )}

      {shareItem && (
        <div className="fixed inset-0 fade-in z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShareItem(null)}>
          <div
            className={`rounded-2xl w-96 p-6 liquid-glass modal-anim border ${d.border} shadow-xl shadow-black/40`}
            style={{ background: d.modalBg }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-1">
              <h3 className={`text-base font-bold ${d.textPrimary}`}>Share link</h3>
              <button onClick={() => setShareItem(null)} className={`${d.textMuted} hover:text-orange-400 active:scale-90 transition`}><X size={18} /></button>
            </div>
            <p className={`text-xs ${d.textMuted} mb-4 truncate`}>{shareItem.name}</p>
            <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 ${d.inputBg} liquid-glass border ${d.border}`}>
              <p className={`text-sm flex-1 truncate font-mono ${d.textSecondary}`}>{shareItem.link}</p>
              <button
                onClick={copyShareLink}
                className={`shrink-0 p-2 rounded-lg transition ${linkCopied ? "bg-emerald-500/15 text-emerald-400" : "bg-orange-500/10 text-orange-400 hover:bg-orange-500/20"}`}
                title="Copy link"
              >
                {linkCopied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            <p className={`text-xs mt-3 ${linkCopied ? "text-emerald-400" : "text-transparent"}`}>Link copied to clipboard</p>
            <p className={`text-xs ${d.textFaint}`}>Anyone with this link can view this file. You can revoke access anytime from Details.</p>
          </div>
        </div>
      )}

      {details && (
        <div className="fixed inset-0 fade-in z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setDetails(null)}>
          <div
            className={`rounded-2xl w-80 p-6 liquid-glass modal-anim border ${d.border} shadow-xl shadow-black/40`}
            style={{ background: d.modalBg }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className={`text-base font-bold ${d.textPrimary}`}>File details</h3>
              <button onClick={() => setDetails(null)} className={`${d.textMuted} hover:text-orange-400 active:scale-90 transition`}><X size={18} /></button>
            </div>
            <div className="flex flex-col gap-3 text-sm">
              <DetailRow label="Name" value={details.name} d={d} />
              <DetailRow label="Type" value={details.type.toUpperCase()} d={d} />
              <DetailRow label="Size" value={details.size || "—"} d={d} />
              <DetailRow label="Uploaded" value={details.uploaded || "—"} d={d} />
              <DetailRow label="Modified" value={details.uploaded || details.meta?.split(" · ")[1] || "—"} d={d} />
              <DetailRow label="Available offline" value={offlineIds.has(details.id) ? "Yes" : "No"} d={d} />
              <div className="pt-1">
                <Badge color="green" icon={CheckCircle2} label="Synced to cloud" />
              </div>
            </div>
          </div>
        </div>
      )}

      {vaultPromptOpen && (
        <div className="fixed inset-0 fade-in z-50 flex items-center justify-center bg-black/60 liquid-glass" onClick={() => setVaultPromptOpen(false)}>
          <div
            className={`rounded-2xl w-72 p-6 liquid-glass modal-anim border ${d.border} shadow-xl shadow-black/40 flex flex-col items-center`}
            style={{ background: d.modalBg }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-orange-500/10 border border-orange-500/30 mb-3">
              <Lock size={18} className="text-orange-400" />
            </div>
            <p className={`text-sm font-medium ${d.textPrimary} mb-4`}>Enter PIN</p>
            <input
              ref={vaultPinRef}
              type="password"
              inputMode="numeric"
              value={vaultPin}
              onChange={(e) => { setVaultPin(e.target.value); setVaultError(false); }}
              onKeyDown={(e) => e.key === "Enter" && submitVaultPin()}
              maxLength={6}
              className={`w-full text-center rounded-xl px-4 py-2.5 text-lg outline-none mb-1 ${d.inputBg} liquid-glass border ${vaultError ? "border-red-500/50" : d.border} ${d.textPrimary}`}
              style={{ letterSpacing: "0.5em" }}
            />
            <p className={`text-xs h-4 mb-4 ${vaultError ? "text-red-400" : "text-transparent"}`}>Incorrect PIN</p>
            <button
              onClick={submitVaultPin}
              className="relative glass-sheen overflow-hidden w-full rounded-xl px-4 py-2.5 text-sm font-bold bg-orange-500 text-black shadow-lg shadow-orange-500/20 transition hover:bg-orange-400"
            >
              Unlock
            </button>
          </div>
        </div>
      )}

      {folderModalOpen && (
        <div className="fixed inset-0 fade-in z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => { setFolderModalOpen(false); setNewFolderName(""); }}>
          <div
            className={`rounded-2xl w-80 p-6 liquid-glass modal-anim border ${d.border} shadow-xl shadow-black/40`}
            style={{ background: d.modalBg }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className={`text-base font-bold ${d.textPrimary}`}>New folder</h3>
              <button onClick={() => { setFolderModalOpen(false); setNewFolderName(""); }} className={`${d.textMuted} hover:text-orange-400 active:scale-90 transition`}><X size={18} /></button>
            </div>
            <p className={`text-xs ${d.textMuted} mb-2`}>Folder name</p>
            <input
              ref={folderNameRef}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmNewFolder()}
              placeholder="Untitled folder"
              className={`w-full rounded-xl px-4 py-2.5 text-sm outline-none mb-5 ${d.inputBg} liquid-glass border ${d.border} ${d.textPrimary} placeholder-zinc-500`}
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => { setFolderModalOpen(false); setNewFolderName(""); }}
                className={`rounded-xl px-4 py-2 text-sm ${d.inputBg} border ${d.border} ${d.textSecondary} transition ${d.hoverBg}`}
              >
                Cancel
              </button>
              <button
                onClick={confirmNewFolder}
                className="relative glass-sheen overflow-hidden rounded-xl px-4 py-2 text-sm font-bold bg-orange-500 text-black shadow-lg shadow-orange-500/20 transition hover:bg-orange-400"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {viewer?.type === "image" && (
        <ImageViewer d={d} items={imageItems} index={viewer.index} onIndex={(i) => setViewer({ ...viewer, index: i, item: imageItems[i] })} onClose={() => setViewer(null)} authUser={authUser} onDownload={realDownload} onShare={openShare} />
      )}

      {viewer?.type === "video" && (
        <div className="fixed inset-0 fade-in z-50 flex items-center justify-center bg-black/70 liquid-glass" onClick={() => setViewer(null)}>
          <div className={`rounded-2xl w-full max-w-2xl overflow-hidden liquid-glass modal-anim border ${d.border} shadow-xl shadow-black/40`} style={{ background: d.modalBg }} onClick={(e) => e.stopPropagation()}>
            <ViewerHeader name={viewer.item.name} onClose={() => setViewer(null)} d={d} onDownload={() => realDownload(viewer.item)} onShare={() => openShare(viewer.item)} />
            <div className="aspect-video flex items-center justify-center relative bg-gradient-to-br from-zinc-900 to-black">
              <button onClick={() => setVideoPlaying((p) => !p)} className="w-16 h-16 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition">
                {videoPlaying ? <Pause size={26} className="text-white" fill="white" /> : <Play size={26} className="text-white ml-1" fill="white" />}
              </button>
            </div>
            <div className={`flex items-center gap-3 px-5 py-3 border-t ${d.divider}`}>
              <button onClick={() => setVideoPlaying((p) => !p)} className={d.textMuted}>
                {videoPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <div className={`flex-1 h-1 rounded-full overflow-hidden ${d.inputBg}`}>
                <div className="h-full rounded-full bg-orange-500" style={{ width: videoPlaying ? "38%" : "0%", transition: "width 1s linear" }} />
              </div>
              <span className={`text-xs font-mono ${d.textMuted}`}>2:14 / 5:40</span>
              <Volume2 size={16} className={d.textMuted} />
              <Maximize2 size={16} className={d.textMuted} />
            </div>
          </div>
        </div>
      )}

      {viewer?.type === "pdf" && (
        <div className="fixed inset-0 fade-in z-50 flex items-center justify-center bg-black/70 liquid-glass" onClick={() => setViewer(null)}>
          <div className={`rounded-2xl w-full max-w-xl flex flex-col overflow-hidden liquid-glass modal-anim border ${d.border} shadow-xl shadow-black/40`} style={{ background: d.modalBg, maxHeight: "85vh" }} onClick={(e) => e.stopPropagation()}>
            <ViewerHeader name={viewer.item.name} sub="Page 1 of 12" onClose={() => setViewer(null)} d={d} onDownload={() => realDownload(viewer.item)} onShare={() => openShare(viewer.item)} />
            <div className="flex-1 overflow-y-auto no-scrollbar p-6 flex justify-center bg-black/20">
              <div className="bg-white rounded-lg w-full max-w-sm p-6 flex flex-col gap-2.5 h-fit shadow-2xl">
                {[95, 88, 92, 60, 0, 90, 84, 70, 0, 80, 55].map((w, i) =>
                  w === 0 ? <div key={i} className="h-3" /> : <div key={i} className="h-2.5 rounded-full bg-slate-200" style={{ width: `${w}%` }} />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {zippingName && (
        <div
          className={`fixed bottom-6 right-4 md:right-6 z-40 flex items-center gap-3 rounded-2xl px-4 py-3 liquid-glass modal-anim border ${d.border} shadow-xl shadow-black/40`}
          style={{ background: d.modalBg }}
        >
          <div className="w-4 h-4 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
          <p className={`text-sm ${d.textPrimary}`}>Zipping <span className="font-medium">{zippingName}</span>…</p>
        </div>
      )}

      {uploads.length > 0 && (
        <div
          className={`fixed bottom-6 right-4 md:right-6 z-40 w-80 rounded-2xl overflow-hidden liquid-glass modal-anim border ${d.border} shadow-xl shadow-black/40`}
          style={{ background: d.modalBg }}
        >
          <div className={`flex items-center justify-between px-4 py-3 border-b ${d.divider} cursor-pointer`} onClick={() => setUploadMinimized((m) => !m)}>
            <p className={`text-sm font-bold ${d.textPrimary}`}>
              {activeUploads > 0 ? `Uploading ${activeUploads} file${activeUploads > 1 ? "s" : ""}` : "Uploads complete"}
            </p>
            <button onClick={(e) => { e.stopPropagation(); setUploads([]); }} className={`${d.textMuted} hover:text-orange-400`}><X size={15} /></button>
          </div>
          {!uploadMinimized && (
            <div className="flex flex-col gap-3 p-4 max-h-56 overflow-y-auto no-scrollbar">
              {uploads.map((u) => (
                <div key={u.id}>
                  <div className="flex items-center justify-between mb-1">
                    <p className={`text-xs truncate flex-1 ${d.textSecondary}`}>{u.name}</p>
                    {u.progress >= 100 ? (
                      <Badge color="green" icon={CheckCircle2} label="Done" />
                    ) : (
                      <Badge color="amber" icon={Upload} label={`${Math.floor(u.progress)}%`} />
                    )}
                  </div>
                  <div className={`h-1.5 rounded-full overflow-hidden ${d.inputBg}`}>
                    <div className="h-full rounded-full bg-orange-500" style={{ width: `${u.progress}%`, transition: "width 0.3s ease" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LoginScreen({ d, theme, setTheme, onLogin }) {
  const [mode, setMode] = useState("signin"); // signin | signup | confirm
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const inputClass = `w-full rounded-xl px-4 py-2.5 text-sm outline-none ${d.inputBg} liquid-glass border ${d.border} ${d.textPrimary} placeholder-zinc-500`;

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await cognitoSignIn(email.trim(), password);
      const idToken = result.AuthenticationResult.IdToken;
      const claims = decodeJWT(idToken);
      onLogin({
        idToken,
        accessToken: result.AuthenticationResult.AccessToken,
        name: claims.name || email.split("@")[0],
        email: claims.email || email,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await cognitoSignUp(email.trim(), password, name.trim());
      setInfo("We sent a verification code to your email.");
      setMode("confirm");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await cognitoConfirmSignUp(email.trim(), code.trim());
      setInfo("Email verified! You can sign in now.");
      setMode("signin");
      setPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`app-root relative min-h-screen w-full overflow-hidden bg-gradient-to-br ${d.bgGradient} font-sans ${d.textPrimary} flex items-center justify-center p-4`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        .font-sans { font-family: 'Inter', system-ui, sans-serif; }
        .liquid-glass { backdrop-filter: blur(28px) saturate(180%); -webkit-backdrop-filter: blur(28px) saturate(180%); }
        .glass-sheen::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(120deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0.05) 30%, rgba(255,255,255,0) 55%, rgba(255,255,255,0.16) 100%);
          box-shadow: inset 0 1px 1px rgba(255,255,255,0.4), inset 0 -12px 20px -14px rgba(0,0,0,0.35);
          pointer-events: none;
        }
        .glass-sheen > * { position: relative; z-index: 1; }
        .app-root, .app-root * { -webkit-user-select: none; user-select: none; }
        .app-root input { -webkit-user-select: text; user-select: text; }
      `}</style>

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className={`absolute inset-0`} style={{ backgroundImage: `radial-gradient(${d.dotColor} 1px, transparent 1px)`, backgroundSize: "24px 24px" }} />
        <div className={`absolute -top-24 -left-20 w-96 h-96 rounded-full ${d.blobs[0]} blur-3xl`} />
        <div className={`absolute top-1/3 -right-24 w-96 h-96 rounded-full ${d.blobs[1]} blur-3xl`} />
        <div className={`absolute -bottom-20 left-1/3 w-96 h-96 rounded-full ${d.blobs[2]} blur-3xl`} />
      </div>

      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className={`fixed top-4 right-4 z-10 p-2.5 rounded-xl ${d.inputBg} liquid-glass relative glass-sheen overflow-hidden border ${d.border} ${d.textMuted}`}
      >
        {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
      </button>

      <div className={`relative z-10 w-full max-w-sm rounded-2xl p-7 liquid-glass relative glass-sheen overflow-hidden border ${d.border} shadow-xl shadow-black/40`} style={{ background: d.modalBg }}>
        <div className="flex items-center gap-2 justify-center mb-6">
          <span className={`text-lg font-extrabold tracking-tight ${d.textPrimary}`}>ethix<span className="text-orange-400">.cloud</span></span>
        </div>

        {mode !== "confirm" && (
          <div className={`relative glass-sheen overflow-hidden flex items-center gap-1 rounded-xl p-1 mb-6 ${d.inputBg} border ${d.border}`}>
            <button
              onClick={() => { setMode("signin"); setError(""); }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${mode === "signin" ? "bg-orange-500 text-black" : d.textMuted}`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode("signup"); setError(""); }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${mode === "signup" ? "bg-orange-500 text-black" : d.textMuted}`}
            >
              Sign Up
            </button>
          </div>
        )}

        {info && <p className="text-xs text-emerald-400 mb-4 text-center">{info}</p>}
        {error && <p className="text-xs text-red-400 mb-4 text-center">{error}</p>}

        {mode === "signin" && (
          <form onSubmit={handleSignIn} className="flex flex-col gap-3">
            <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            <button type="submit" disabled={loading} className="relative glass-sheen overflow-hidden mt-1 rounded-xl py-2.5 text-sm font-bold bg-orange-500 text-black shadow-lg shadow-orange-500/20 transition hover:bg-orange-400 active:scale-95 flex items-center justify-center gap-2">
              {loading && <Loader2 size={15} className="animate-spin" />}
              Sign In
            </button>
          </form>
        )}

        {mode === "signup" && (
          <form onSubmit={handleSignUp} className="flex flex-col gap-3">
            <input required placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            <input type="password" required minLength={8} placeholder="Password (min 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            <button type="submit" disabled={loading} className="relative glass-sheen overflow-hidden mt-1 rounded-xl py-2.5 text-sm font-bold bg-orange-500 text-black shadow-lg shadow-orange-500/20 transition hover:bg-orange-400 active:scale-95 flex items-center justify-center gap-2">
              {loading && <Loader2 size={15} className="animate-spin" />}
              Create Account
            </button>
          </form>
        )}

        {mode === "confirm" && (
          <form onSubmit={handleConfirm} className="flex flex-col gap-3">
            <p className={`text-sm ${d.textSecondary} mb-1`}>Enter the code sent to <span className={d.textPrimary}>{email}</span></p>
            <input required placeholder="Verification code" value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} />
            <button type="submit" disabled={loading} className="relative glass-sheen overflow-hidden mt-1 rounded-xl py-2.5 text-sm font-bold bg-orange-500 text-black shadow-lg shadow-orange-500/20 transition hover:bg-orange-400 active:scale-95 flex items-center justify-center gap-2">
              {loading && <Loader2 size={15} className="animate-spin" />}
              Verify Email
            </button>
            <button type="button" onClick={() => { setMode("signin"); setError(""); }} className={`text-xs ${d.textMuted} hover:text-orange-400 transition`}>
              Back to Sign In
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function TiltCard({ children, className, style, onClick, onLongPress }) {
  const ref = useRef(null);
  const [rot, setRot] = useState({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const rafRef = useRef(null);
  const pressTimer = useRef(null);
  const longPressed = useRef(false);

  useEffect(() => {
    const stiffness = 240;
    const damping = 22;
    let last = performance.now();

    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 0.032);
      last = now;
      setRot((prev) => {
        const next = { ...prev };
        for (const axis of ["x", "y"]) {
          const displacement = target.current[axis] - prev[axis];
          const accel = displacement * stiffness - velocity.current[axis] * damping;
          velocity.current[axis] += accel * dt;
          next[axis] = prev[axis] + velocity.current[axis] * dt;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const handleMove = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const offsetX = Math.max(-60, Math.min(60, e.clientX - rect.left - rect.width / 2));
    const offsetY = Math.max(-60, Math.min(60, e.clientY - rect.top - rect.height / 2));
    target.current = { x: (offsetY / 60) * -12, y: (offsetX / 60) * 12 };
  };

  const handleLeave = () => {
    target.current = { x: 0, y: 0 };
  };

  const handlePressStart = (e) => {
    longPressed.current = false;
    const point = e.touches?.[0] ?? e;
    const x = point.clientX ?? 0;
    const y = point.clientY ?? 0;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      if (navigator.vibrate) navigator.vibrate(12);
      onLongPress?.(x, y);
    }, 480);
  };

  const clearPressTimer = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const handleClick = (e) => {
    if (longPressed.current) {
      e.preventDefault();
      longPressed.current = false;
      return;
    }
    onClick?.(e);
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={(e) => { handleLeave(); clearPressTimer(); }}
      onClick={handleClick}
      onTouchStart={onLongPress ? handlePressStart : undefined}
      onTouchEnd={onLongPress ? clearPressTimer : undefined}
      onTouchMove={onLongPress ? clearPressTimer : undefined}
      onMouseDown={onLongPress ? handlePressStart : undefined}
      onMouseUp={onLongPress ? clearPressTimer : undefined}
      onContextMenu={onLongPress ? (e) => e.preventDefault() : undefined}
      className={className}
      style={{
        ...style,
        transform: `perspective(1100px) rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
        backfaceVisibility: "hidden",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {children}
    </div>
  );
}

function BorderBeamCard({ d, children }) {
  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ padding: "2px" }}>
      <div
        className="beam-spin absolute"
        style={{
          top: "-150%",
          left: "-150%",
          right: "-150%",
          bottom: "-150%",
          background: "conic-gradient(from 0deg, transparent 0%, transparent 78%, #FDBA74 88%, #F97316 93%, #FDBA74 97%, transparent 100%)",
        }}
      />
      <div className="relative rounded-2xl" style={{ background: d.solidBg }}>
        {children}
      </div>
    </div>
  );
}

function AccountPage({ d, theme, onBack, authUser, userInitials, onLogout, totalStorageGB }) {
  return (
    <div className="max-w-2xl">
      <button onClick={onBack} className={`md:hidden flex items-center gap-2 text-sm mb-4 ${d.textSecondary} hover:text-orange-400 transition`}>
        <ArrowLeft size={15} /> Back to My Files
      </button>

      {/* Profile card */}
      <div className={`rounded-2xl p-5 mb-6 border ${d.border} liquid-glass`} style={{ background: d.cardBg }}>
        <div className="flex items-center gap-4">
          <div className="relative glass-sheen overflow-hidden w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold bg-orange-500 text-black shrink-0">
            {userInitials}
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-base font-bold ${d.textPrimary} truncate`}>{authUser.name}</p>
            <p className={`text-sm ${d.textMuted} truncate`}>{authUser.email}</p>
          </div>
          <button className={`text-xs rounded-lg px-3 py-1.5 ${d.inputBg} border ${d.border} ${d.textSecondary} transition ${d.hoverBg}`}>
            Edit
          </button>
          <button onClick={onLogout} className="text-xs rounded-lg px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 transition hover:bg-red-500/20">
            Log Out
          </button>
        </div>

        <div className={`grid grid-cols-3 gap-3 mt-5 pt-5 border-t ${d.divider}`}>
          <div>
            <p className={`text-xs uppercase tracking-wider ${d.textMuted} font-semibold mb-1`}>Plan</p>
            <p className={`text-sm font-medium ${d.textPrimary}`}>Free</p>
          </div>
          <div>
            <p className={`text-xs uppercase tracking-wider ${d.textMuted} font-semibold mb-1`}>Storage used</p>
            <p className={`text-sm font-medium ${d.textPrimary} font-mono`}>{totalStorageGB} GB</p>
          </div>
          <div>
            <p className={`text-xs uppercase tracking-wider ${d.textMuted} font-semibold mb-1`}>Member since</p>
            <p className={`text-sm font-medium ${d.textPrimary}`}>Jul 2026</p>
          </div>
        </div>
      </div>

      {/* Subscription section */}
      <p className={`text-xs uppercase tracking-wider ${d.textMuted} font-semibold mb-3`}>Subscription</p>
      <BorderBeamCard d={d}>
        <div className="p-6 relative overflow-hidden">
          <div className="absolute top-4 right-4">
            <Badge color="amber" icon={Clock} label="Coming Soon" />
          </div>
          <p className={`text-sm font-bold ${d.textPrimary} mb-1`}>ethix.cloud Pro</p>
          <p className={`text-xs ${d.textMuted} mb-4 max-w-sm`}>
            More storage, faster uploads, and priority support. Paid plans aren't live yet — you're on Free for now, and there's nothing you need to do.
          </p>
          <div className="flex flex-col gap-2 opacity-50 pointer-events-none">
            {["More storage tiers", "Priority upload speed", "Advanced sharing controls"].map((f) => (
              <div key={f} className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-orange-400 shrink-0" />
                <span className={`text-sm ${d.textSecondary}`}>{f}</span>
              </div>
            ))}
          </div>
          <button disabled className={`mt-5 w-full rounded-xl px-4 py-2.5 text-sm font-bold ${d.inputBg} border ${d.border} ${d.textFaint} cursor-not-allowed`}>
            Coming Soon
          </button>
        </div>
      </BorderBeamCard>
    </div>
  );
}

function ThemeToggle({ theme, setTheme, d }) {
  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className={`relative w-11 h-6 rounded-full transition active:scale-90 border ${d.border} shrink-0`}
      style={{ background: theme === "dark" ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.08)" }}
      title="Toggle theme"
    >
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full flex items-center justify-center bg-orange-500 shadow-md shadow-orange-500/30"
        style={{ left: theme === "dark" ? "2px" : "calc(100% - 22px)", transition: "left 350ms cubic-bezier(0.34, 1.56, 0.64, 1)" }}
      >
        {theme === "dark" ? <Moon size={11} className="text-black" /> : <Sun size={11} className="text-black" />}
      </span>
    </button>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger, d }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition active:scale-95 ${danger ? "text-red-400 hover:bg-red-500/10" : `${d.textSecondary} ${d.hoverBg}`}`}
    >
      <Icon size={15} /> {label}
    </button>
  );
}

function DetailRow({ label, value, d }) {
  return (
    <div className="flex items-center justify-between">
      <span className={d.textMuted}>{label}</span>
      <span className={`font-mono text-xs ${d.textPrimary}`}>{value}</span>
    </div>
  );
}

function ViewerHeader({ name, sub, onClose, d, onDownload, onShare }) {
  return (
    <div className={`flex items-center justify-between px-5 py-3.5 border-b ${d.divider}`}>
      <div>
        <p className={`text-sm font-medium ${d.textPrimary}`}>{name}</p>
        {sub && <p className={`text-xs font-mono mt-0.5 ${d.textMuted}`}>{sub}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={onDownload} className={`${d.textMuted} hover:text-orange-400 transition`}>
          <Download size={16} />
        </button>
        <button onClick={onShare} className={`${d.textMuted} hover:text-orange-400 transition`}>
          <Share2 size={16} />
        </button>
        <button onClick={onClose} className={`${d.textMuted} hover:text-orange-400 active:scale-90 transition`}><X size={18} /></button>
      </div>
    </div>
  );
}

function ImageViewer({ items, index, onIndex, onClose, d, authUser, onDownload, onShare }) {
  const item = items[index];
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPreviewUrl(null);
    setLoadError(false);
    apiRequest("GET", `/download-url/${item.itemId || item.id}?mode=preview`, authUser.idToken)
      .then((data) => {
        if (!cancelled) setPreviewUrl(data.downloadUrl);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [item.id]);

  return (
    <div className="fixed inset-0 fade-in z-50 flex items-center justify-center bg-black/75 liquid-glass" onClick={onClose}>
      <div className={`rounded-2xl w-full max-w-2xl overflow-hidden liquid-glass modal-anim border ${d.border} shadow-xl shadow-black/40`} style={{ background: d.modalBg }} onClick={(e) => e.stopPropagation()}>
        <ViewerHeader name={item.name} sub={`${item.size} · ${item.uploaded}`} onClose={onClose} d={d} onDownload={() => onDownload(item)} onShare={() => onShare(item)} />
        <div className={`aspect-[4/3] flex items-center justify-center relative bg-gradient-to-br ${d.mediaGradient}`}>
          {index > 0 && (
            <button onClick={() => onIndex(index - 1)} className="absolute left-3 w-9 h-9 rounded-full flex items-center justify-center text-white bg-black/40 hover:bg-black/60 transition">
              <ChevronLeft size={18} />
            </button>
          )}
          {loadError ? (
            <ImageIcon size={40} className={d.placeholderText} />
          ) : previewUrl ? (
            <img src={previewUrl} alt={item.name} className="max-w-full max-h-full object-contain" />
          ) : (
            <Loader2 size={28} className={`animate-spin ${d.placeholderText}`} />
          )}
          {index < items.length - 1 && (
            <button onClick={() => onIndex(index + 1)} className="absolute right-3 w-9 h-9 rounded-full flex items-center justify-center text-white bg-black/40 hover:bg-black/60 transition">
              <ChevronRight size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
