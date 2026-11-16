import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

/**
 * Starter catalog: real services phone shops buy every week, so a new store isn't empty.
 * Prices are suggestions only (USD cents) — staff link each option to a supplier service and check the margin
 * before publishing. Everything is created as a draft unless `publish` is set (local demo only).
 */
type L = { en: string; ht: string; fr: string; es: string };
type Opt = { name: L; price: number; min?: number; max?: number; pack?: number };
type Svc = { slug: string; cat: string; type: "IMEI" | "SERVER" | "REMOTE"; name: L; desc: L; time: L; tags: string[]; options: Opt[]; style?: string; featured?: boolean; format?: "imei" | "serial" | "any" };

const T = {
  instant: { en: "Instant", ht: "Imedya", fr: "Instantané", es: "Instantáneo" },
  min30: { en: "30 min", ht: "30 min", fr: "30 min", es: "30 min" },
  h1_24: { en: "1–24 hours", ht: "1–24 è", fr: "1–24 h", es: "1–24 horas" },
  d1_3: { en: "1–3 days", ht: "1–3 jou", fr: "1–3 jours", es: "1–3 días" },
  d1_5: { en: "1–5 days", ht: "1–5 jou", fr: "1–5 jours", es: "1–5 días" },
  d2_4: { en: "2–4 days", ht: "2–4 jou", fr: "2–4 jours", es: "2–4 días" },
  d3_7: { en: "3–7 days", ht: "3–7 jou", fr: "3–7 jours", es: "3–7 días" },
  h1_6: { en: "1–6 hours", ht: "1–6 è", fr: "1–6 h", es: "1–6 horas" },
} satisfies Record<string, L>;

const clean: L = { en: "Clean IMEI", ht: "IMEI pwòp", fr: "IMEI propre", es: "IMEI limpio" };
const premium: L = { en: "Premium · unpaid or financed", ht: "Premium · pa peye oswa sou kredi", fr: "Premium · impayé ou financé", es: "Premium · impago o financiado" };
const unlockDesc = (carrier: string): L => ({
  en: `Permanent factory unlock for iPhones locked to ${carrier}. Works with any SIM afterwards, survives updates. The phone must not be reported lost or stolen.`,
  ht: `Debloke pèmanan pou iPhone ki bloke sou ${carrier}. Apre sa li mache ak nenpòt SIM, menm apre mizajou. Telefòn nan pa dwe deklare pèdi oswa vòlè.`,
  fr: `Déblocage usine définitif pour les iPhone verrouillés sur ${carrier}. Fonctionne ensuite avec toute SIM, même après mise à jour. Le téléphone ne doit pas être déclaré perdu ou volé.`,
  es: `Liberación de fábrica permanente para iPhone bloqueados con ${carrier}. Luego funciona con cualquier SIM, incluso tras actualizar. El teléfono no debe estar reportado como perdido o robado.`,
});
const months = (n: number): L => ({ en: `${n} months`, ht: `${n} mwa`, fr: `${n} mois`, es: `${n} meses` });
const license = (tool: string): L => ({
  en: `Official ${tool} license activated on your account. Send the username you use to sign in to ${tool}.`,
  ht: `Lisans ofisyèl ${tool} aktive sou kont ou. Voye non itilizatè w itilize pou konekte sou ${tool}.`,
  fr: `Licence ${tool} officielle activée sur votre compte. Indiquez l'identifiant utilisé pour vous connecter à ${tool}.`,
  es: `Licencia oficial de ${tool} activada en tu cuenta. Envía el usuario con el que entras a ${tool}.`,
});

export const STARTER: Svc[] = [
  // ─── Carrier unlock ───
  { slug: "iphone-usa-att-unlock", cat: "carrier-unlock", type: "IMEI", name: { en: "iPhone USA AT&T unlock", ht: "Debloke iPhone USA AT&T", fr: "Déblocage iPhone USA AT&T", es: "Liberación iPhone USA AT&T" }, desc: unlockDesc("AT&T (USA)"), time: T.d1_3, tags: ["platform:apple", "region:us"], featured: true, options: [{ name: clean, price: 2500 }, { name: premium, price: 4500 }] },
  { slug: "iphone-usa-tmobile-unlock", cat: "carrier-unlock", type: "IMEI", name: { en: "iPhone USA T-Mobile / Metro unlock", ht: "Debloke iPhone USA T-Mobile / Metro", fr: "Déblocage iPhone USA T-Mobile / Metro", es: "Liberación iPhone USA T-Mobile / Metro" }, desc: unlockDesc("T-Mobile or Metro by T-Mobile (USA)"), time: T.d1_5, tags: ["platform:apple", "region:us"], featured: true, options: [{ name: clean, price: 3500 }, { name: premium, price: 6000 }] },
  { slug: "iphone-usa-verizon-unlock", cat: "carrier-unlock", type: "IMEI", name: { en: "iPhone USA Verizon unlock", ht: "Debloke iPhone USA Verizon", fr: "Déblocage iPhone USA Verizon", es: "Liberación iPhone USA Verizon" }, desc: unlockDesc("Verizon (USA)"), time: T.h1_24, tags: ["platform:apple", "region:us"], options: [{ name: clean, price: 1200 }] },
  { slug: "iphone-usa-cricket-unlock", cat: "carrier-unlock", type: "IMEI", name: { en: "iPhone USA Cricket unlock", ht: "Debloke iPhone USA Cricket", fr: "Déblocage iPhone USA Cricket", es: "Liberación iPhone USA Cricket" }, desc: unlockDesc("Cricket Wireless (USA)"), time: T.d2_4, tags: ["platform:apple", "region:us"], options: [{ name: clean, price: 2200 }] },
  { slug: "iphone-canada-unlock", cat: "carrier-unlock", type: "IMEI", name: { en: "iPhone Canada unlock (Rogers, Bell, Telus)", ht: "Debloke iPhone Kanada (Rogers, Bell, Telus)", fr: "Déblocage iPhone Canada (Rogers, Bell, Telus)", es: "Liberación iPhone Canadá (Rogers, Bell, Telus)" }, desc: unlockDesc("Rogers, Bell, Telus or Fido (Canada)"), time: T.d1_5, tags: ["platform:apple", "region:ca"], options: [{ name: clean, price: 3000 }] },
  { slug: "samsung-network-unlock-code", cat: "carrier-unlock", type: "IMEI", name: { en: "Samsung network unlock code", ht: "Kòd debloke Samsung", fr: "Code de déblocage Samsung", es: "Código de liberación Samsung" }, desc: { en: "Unlock code for Samsung Galaxy phones from most carriers worldwide. Type the code when the phone asks for it with a foreign SIM.", ht: "Kòd pou debloke telefòn Samsung Galaxy pifò operatè nan mond lan. Tape kòd la lè telefòn nan mande l ak yon lòt SIM.", fr: "Code de déblocage pour Samsung Galaxy de la plupart des opérateurs. Saisissez-le quand le téléphone le demande avec une autre SIM.", es: "Código para liberar Samsung Galaxy de la mayoría de operadores. Escríbelo cuando el teléfono lo pida con otra SIM." }, time: T.h1_24, tags: ["platform:android"], options: [{ name: { en: "All models", ht: "Tout modèl", fr: "Tous modèles", es: "Todos los modelos" }, price: 1200 }] },
  { slug: "motorola-unlock-code", cat: "carrier-unlock", type: "IMEI", name: { en: "Motorola network unlock code", ht: "Kòd debloke Motorola", fr: "Code de déblocage Motorola", es: "Código de liberación Motorola" }, desc: { en: "Network unlock code for Motorola phones (most carriers).", ht: "Kòd debloke pou telefòn Motorola (pifò operatè).", fr: "Code de déblocage réseau pour Motorola (la plupart des opérateurs).", es: "Código de liberación para Motorola (la mayoría de operadores)." }, time: T.h1_24, tags: ["platform:android"], options: [{ name: { en: "All models", ht: "Tout modèl", fr: "Tous modèles", es: "Todos los modelos" }, price: 800 }] },
  // ─── IMEI checks ───
  { slug: "full-imei-check", cat: "imei-checks", type: "IMEI", name: { en: "Full iPhone check (carrier, blacklist, iCloud)", ht: "Tchèk iPhone konplè (operatè, lis nwa, iCloud)", fr: "Vérification iPhone complète (opérateur, liste noire, iCloud)", es: "Verificación iPhone completa (operador, lista negra, iCloud)" }, desc: { en: "Model, carrier lock, blacklist, Find My (iCloud) and warranty in one report. Run it before buying or unlocking.", ht: "Modèl, operatè, lis nwa, Find My (iCloud) ak garanti nan yon sèl rapò. Fè l anvan ou achte oswa debloke.", fr: "Modèle, verrouillage opérateur, liste noire, Localiser (iCloud) et garantie en un rapport. À faire avant d'acheter ou débloquer.", es: "Modelo, bloqueo de operador, lista negra, Buscar (iCloud) y garantía en un informe. Hazlo antes de comprar o liberar." }, time: T.instant, tags: ["platform:apple"], featured: true, options: [{ name: { en: "Full report", ht: "Rapò konplè", fr: "Rapport complet", es: "Informe completo" }, price: 150 }] },
  { slug: "icloud-fmi-check", cat: "imei-checks", type: "IMEI", name: { en: "iCloud Find My status (ON/OFF)", ht: "Estati iCloud Find My (ON/OFF)", fr: "Statut iCloud Localiser (ON/OFF)", es: "Estado iCloud Buscar (ON/OFF)" }, desc: { en: "Tells you if Find My iPhone is on, and if the device is clean or reported lost.", ht: "Di w si Find My iPhone aktive, epi si aparèy la pwòp oswa deklare pèdi.", fr: "Indique si Localiser est activé, et si l'appareil est propre ou déclaré perdu.", es: "Indica si Buscar está activado y si el equipo está limpio o reportado perdido." }, time: T.instant, tags: ["platform:apple"], options: [{ name: { en: "Status", ht: "Estati", fr: "Statut", es: "Estado" }, price: 25 }] },
  { slug: "gsma-blacklist-check", cat: "imei-checks", type: "IMEI", name: { en: "GSMA blacklist check (all brands)", ht: "Tchèk lis nwa GSMA (tout mak)", fr: "Vérification liste noire GSMA (toutes marques)", es: "Verificación lista negra GSMA (todas las marcas)" }, desc: { en: "Checks the worldwide GSMA database for lost, stolen or unpaid reports. Works for every brand.", ht: "Tchèk baz done GSMA nan tout mond lan pou rapò pèdi, vòlè oswa pa peye. Mache pou tout mak.", fr: "Interroge la base mondiale GSMA (perdu, volé, impayé). Toutes marques.", es: "Consulta la base mundial GSMA (perdido, robado, impago). Todas las marcas." }, time: T.instant, tags: [], options: [{ name: { en: "Worldwide", ht: "Tout mond", fr: "Monde", es: "Mundial" }, price: 30 }] },
  { slug: "samsung-info-check", cat: "imei-checks", type: "IMEI", name: { en: "Samsung info check (carrier, Knox, warranty)", ht: "Tchèk enfòmasyon Samsung (operatè, Knox, garanti)", fr: "Infos Samsung (opérateur, Knox, garantie)", es: "Info Samsung (operador, Knox, garantía)" }, desc: { en: "Model, original carrier, country, Knox status and warranty for Samsung phones.", ht: "Modèl, operatè orijinal, peyi, Knox ak garanti pou telefòn Samsung.", fr: "Modèle, opérateur d'origine, pays, Knox et garantie des Samsung.", es: "Modelo, operador original, país, Knox y garantía de Samsung." }, time: T.instant, tags: ["platform:android"], options: [{ name: { en: "Full report", ht: "Rapò konplè", fr: "Rapport complet", es: "Informe completo" }, price: 80 }] },
  // ─── Tool licenses & credits ───
  { slug: "unlocktool-license", cat: "unlocktool", type: "SERVER", name: { en: "UnlockTool license", ht: "Lisans UnlockTool", fr: "Licence UnlockTool", es: "Licencia UnlockTool" }, desc: license("UnlockTool"), time: T.min30, tags: [], featured: true, format: "any", options: [{ name: months(3), price: 2000 }, { name: months(6), price: 3000 }, { name: months(12), price: 5000 }] },
  { slug: "chimera-credits", cat: "chimera", type: "SERVER", name: { en: "Chimera Tool credits", ht: "Kredi Chimera Tool", fr: "Crédits Chimera Tool", es: "Créditos Chimera Tool" }, desc: { en: "Credits added to your Chimera account. Choose how many.", ht: "Kredi ajoute sou kont Chimera ou. Chwazi konbyen.", fr: "Crédits ajoutés à votre compte Chimera. Choisissez la quantité.", es: "Créditos añadidos a tu cuenta Chimera. Elige cuántos." }, time: T.instant, tags: [], format: "any", options: [{ name: { en: "Credits", ht: "Kredi", fr: "Crédits", es: "Créditos" }, price: 6, min: 10, max: 2000 }] },
  { slug: "chimera-license", cat: "chimera", type: "SERVER", name: { en: "Chimera Tool license", ht: "Lisans Chimera Tool", fr: "Licence Chimera Tool", es: "Licencia Chimera Tool" }, desc: license("Chimera Tool"), time: T.min30, tags: [], format: "any", options: [{ name: { en: "Basic · 12 months", ht: "Basic · 12 mwa", fr: "Basic · 12 mois", es: "Basic · 12 meses" }, price: 6900 }, { name: { en: "Pro · 12 months", ht: "Pro · 12 mwa", fr: "Pro · 12 mois", es: "Pro · 12 meses" }, price: 13900 }] },
  { slug: "octoplus-samsung-activation", cat: "octoplus", type: "SERVER", name: { en: "Octoplus Samsung activation", ht: "Aktivasyon Octoplus Samsung", fr: "Activation Octoplus Samsung", es: "Activación Octoplus Samsung" }, desc: { en: "Activation for your Octoplus box or dongle (Samsung module). Send the box serial number.", ht: "Aktivasyon pou bwat oswa dongle Octoplus ou (modil Samsung). Voye nimewo seri bwat la.", fr: "Activation pour votre box ou dongle Octoplus (module Samsung). Indiquez le numéro de série.", es: "Activación para tu caja o dongle Octoplus (módulo Samsung). Envía el número de serie." }, time: T.h1_6, tags: ["platform:android"], format: "any", options: [{ name: { en: "Samsung module", ht: "Modil Samsung", fr: "Module Samsung", es: "Módulo Samsung" }, price: 4000 }] },
  { slug: "tfm-tool-license", cat: "tool-licenses", type: "SERVER", name: { en: "TFM Tool Pro license", ht: "Lisans TFM Tool Pro", fr: "Licence TFM Tool Pro", es: "Licencia TFM Tool Pro" }, desc: license("TFM Tool Pro"), time: T.min30, tags: [], format: "any", options: [{ name: months(12), price: 2800 }] },
  { slug: "dft-pro-license", cat: "tool-licenses", type: "SERVER", name: { en: "DFT Pro license", ht: "Lisans DFT Pro", fr: "Licence DFT Pro", es: "Licencia DFT Pro" }, desc: license("DFT Pro"), time: T.min30, tags: [], format: "any", options: [{ name: months(12), price: 4500 }] },
  // ─── Remote services ───
  { slug: "samsung-frp-remove-remote", cat: "remote-services", type: "REMOTE", name: { en: "Samsung FRP remove (remote)", ht: "Retire FRP Samsung (a distans)", fr: "Suppression FRP Samsung (à distance)", es: "Quitar FRP Samsung (remoto)" }, desc: { en: "Our technician removes the Google account lock (FRP) through AnyDesk or TeamViewer. Have the phone connected to a computer.", ht: "Teknisyen nou an retire blokaj kont Google (FRP) atravè AnyDesk oswa TeamViewer. Telefòn nan dwe konekte sou yon òdinatè.", fr: "Notre technicien retire le verrou Google (FRP) via AnyDesk ou TeamViewer. Le téléphone doit être branché à un ordinateur.", es: "Nuestro técnico quita el bloqueo de Google (FRP) por AnyDesk o TeamViewer. El teléfono debe estar conectado a una computadora." }, time: T.min30, tags: ["platform:android"], format: "any", options: [{ name: { en: "All Samsung models", ht: "Tout modèl Samsung", fr: "Tous modèles Samsung", es: "Todos los Samsung" }, price: 900 }] },
  { slug: "xiaomi-mi-account-remove", cat: "remote-services", type: "REMOTE", name: { en: "Xiaomi Mi account remove (remote)", ht: "Retire kont Mi Xiaomi (a distans)", fr: "Suppression compte Mi Xiaomi (à distance)", es: "Quitar cuenta Mi Xiaomi (remoto)" }, desc: { en: "Removes the Mi account lock on supported Xiaomi, Redmi and Poco phones, by remote session.", ht: "Retire blokaj kont Mi sou telefòn Xiaomi, Redmi ak Poco ki sipòte, pa sesyon a distans.", fr: "Retire le verrou du compte Mi sur les Xiaomi, Redmi et Poco compatibles, par session à distance.", es: "Quita el bloqueo de cuenta Mi en Xiaomi, Redmi y Poco compatibles, por sesión remota." }, time: T.h1_6, tags: ["platform:android"], format: "any", options: [{ name: { en: "Supported models", ht: "Modèl ki sipòte", fr: "Modèles compatibles", es: "Modelos compatibles" }, price: 2500 }] },
];

const CATS: { slug: string; name: L; isTool?: boolean; code?: string; image?: string; sortOrder: number }[] = [
  { slug: "carrier-unlock", name: { en: "Carrier unlock", ht: "Debloke operatè", fr: "Déblocage opérateur", es: "Liberación de operador" }, sortOrder: 0 },
  { slug: "imei-checks", name: { en: "IMEI checks", ht: "Tchèk IMEI", fr: "Vérifications IMEI", es: "Verificaciones IMEI" }, sortOrder: 1 },
  { slug: "tool-licenses", name: { en: "Tool licenses & credits", ht: "Lisans ak kredi zouti", fr: "Licences et crédits d'outils", es: "Licencias y créditos" }, sortOrder: 2 },
  { slug: "remote-services", name: { en: "Remote services", ht: "Sèvis a distans", fr: "Services à distance", es: "Servicios remotos" }, sortOrder: 3 },
  { slug: "unlocktool", name: { en: "UnlockTool", ht: "UnlockTool", fr: "UnlockTool", es: "UnlockTool" }, isTool: true, code: "UT", sortOrder: 10 },
  { slug: "chimera", name: { en: "Chimera", ht: "Chimera", fr: "Chimera", es: "Chimera" }, isTool: true, code: "CH", sortOrder: 11 },
  { slug: "octoplus", name: { en: "Octoplus", ht: "Octoplus", fr: "Octoplus", es: "Octoplus" }, isTool: true, code: "OP", image: "/logos/octoplus.svg", sortOrder: 12 },
];

/** Adds what is missing (existing categories and services, matched by slug, are left alone). Returns how many services were added. */
export async function installStarterCatalog(opts: { publish?: boolean } = {}): Promise<{ added: number; skipped: number }> {
  const catId = new Map<string, string>();
  for (const c of CATS) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, name: c.name, isTool: !!c.isTool, code: c.code ?? null, image: c.image ?? null, sortOrder: c.sortOrder, inMenu: true },
      update: {},
    });
    catId.set(c.slug, row.id);
  }
  let added = 0;
  let skipped = 0;
  for (const [i, s] of STARTER.entries()) {
    if (await prisma.product.findUnique({ where: { slug: s.slug }, select: { id: true } })) {
      skipped++;
      continue;
    }
    const data: Prisma.ProductCreateInput = {
      slug: s.slug,
      category: { connect: { id: catId.get(s.cat)! } },
      name: s.name,
      description: s.desc,
      deliveryEstimate: s.time,
      tags: s.tags,
      serviceType: s.type,
      identifierFormat: s.format ?? "imei",
      allowBulk: s.type === "IMEI",
      isPublished: !!opts.publish,
      isFeatured: !!s.featured,
      sortOrder: i,
      cardStyle: s.style ?? (i % 3 === 0 ? "ink" : i % 3 === 1 ? "green" : "mint"),
      fields: s.type === "SERVER" ? [{ key: "username", type: "text", label: { en: "Your username", ht: "Non itilizatè w", fr: "Votre identifiant", es: "Tu usuario" }, required: true, remember: true }] : s.type === "REMOTE" ? [{ key: "remote", type: "remoteId", label: { en: "AnyDesk or TeamViewer ID", ht: "ID AnyDesk oswa TeamViewer", fr: "ID AnyDesk ou TeamViewer", es: "ID de AnyDesk o TeamViewer" }, required: true }] : [],
      variants: { create: s.options.map((o, k) => ({ name: o.name, priceUsd: o.price, sortOrder: k, minQty: o.min ?? 1, maxQty: o.max ?? 1, packSize: o.pack ?? 1 })) },
    };
    await prisma.product.create({ data });
    added++;
  }
  return { added, skipped };
}
