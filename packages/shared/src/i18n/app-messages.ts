import type { KashuLocaleCode } from "../money-format";
import { normalizeLocale } from "../money-format";

/** App-wide strings — navigation, chrome, settings (all MotiveLife modules). */
export type AppMessageKey =
  | "nav.dayo"
  | "nav.dayo.sub"
  | "nav.lifevue"
  | "nav.lifevue.sub"
  | "nav.kinzo"
  | "nav.kinzo.sub"
  | "nav.uplift"
  | "nav.uplift.sub"
  | "nav.vyra"
  | "nav.vyra.sub"
  | "nav.kashu"
  | "nav.kashu.sub"
  | "nav.vitalu"
  | "nav.vitalu.sub"
  | "nav.motiveiq"
  | "nav.motiveiq.sub"
  | "nav.signals"
  | "nav.signals.sub"
  | "nav.connect"
  | "nav.connect.sub"
  | "nav.settings"
  | "nav.settings.sub"
  | "nav.group.main"
  | "nav.group.intelligence"
  | "nav.tasks"
  | "nav.learning"
  | "nav.career"
  | "nav.habits"
  | "nav.relationships"
  | "common.save"
  | "common.saved"
  | "common.loading"
  | "common.signOut"
  | "common.closeMenu"
  | "common.refresh"
  | "settings.title"
  | "settings.subtitle"
  | "settings.language"
  | "settings.languageHint"
  | "settings.currency"
  | "settings.currencyHint"
  | "settings.saveLocale"
  | "settings.savedLocale"
  | "settings.useDevice"
  | "settings.detected"
  | "greeting.morning"
  | "greeting.afternoon"
  | "greeting.evening"
  | "greeting.hey"
  | "tagline.suite"
  | "module.vitalu.hero"
  | "module.kashu.hero"
  | "module.kinzo.hero"
  | "module.dayo.hero"
  | "module.lifevue.hero"
  | "module.uplift.hero"
  | "module.vyra.hero";

type Table = Record<AppMessageKey, string>;

const en: Table = {
  "nav.dayo": "DayO",
  "nav.dayo.sub": "Your day",
  "nav.lifevue": "LifeVue",
  "nav.lifevue.sub": "Your life in one view",
  "nav.kinzo": "KINZO AI",
  "nav.kinzo.sub": "Family intelligence in motion",
  "nav.uplift": "UPLIFT",
  "nav.uplift.sub": "Your goals, elevated",
  "nav.vyra": "VYRA AI",
  "nav.vyra.sub": "Chief of Staff",
  "nav.kashu": "Kashu",
  "nav.kashu.sub": "Safe to spend",
  "nav.vitalu": "Vitalu",
  "nav.vitalu.sub": "Health operating engine",
  "nav.motiveiq": "MotiveIQ",
  "nav.motiveiq.sub": "Patterns, memory & insights",
  "nav.signals": "Signals",
  "nav.signals.sub": "What your AI noticed",
  "nav.connect": "Connect",
  "nav.connect.sub": "Apps, devices & services",
  "nav.settings": "Settings",
  "nav.settings.sub": "Preferences & privacy",
  "nav.group.main": "Main Apps",
  "nav.group.intelligence": "Intelligence",
  "nav.tasks": "Tasks",
  "nav.learning": "Learning",
  "nav.career": "Career",
  "nav.habits": "Habits",
  "nav.relationships": "Relationships",
  "common.save": "Save",
  "common.saved": "Saved.",
  "common.loading": "Loading…",
  "common.signOut": "Sign out",
  "common.closeMenu": "Close menu",
  "common.refresh": "Refresh",
  "settings.title": "Settings",
  "settings.subtitle": "Language, currency, and preferences for all of MotiveLife.",
  "settings.language": "Language",
  "settings.languageHint":
    "Applies across DayO, LifeVue, KINZO, Kashu, Vitalu, UPLIFT, VYRA, and the rest of your Mode of Life.",
  "settings.currency": "Default currency",
  "settings.currencyHint": "Used for Kashu and money views. You can override in Kashu → Buffers.",
  "settings.saveLocale": "Save language & region",
  "settings.savedLocale": "Language and region saved.",
  "settings.useDevice": "Use device language",
  "settings.detected": "Detected from your device",
  "greeting.morning": "Good morning",
  "greeting.afternoon": "Good afternoon",
  "greeting.evening": "Good evening",
  "greeting.hey": "Hey",
  "tagline.suite": "One AI. Every Stage of Life.",
  "module.vitalu.hero": "Your Health. Your Plan. Your Life.",
  "module.kashu.hero": "Know what's safe before you spend",
  "module.kinzo.hero": "Family intelligence in motion",
  "module.dayo.hero": "Your day",
  "module.lifevue.hero": "Your life in one view",
  "module.uplift.hero": "Your goals, elevated",
  "module.vyra.hero": "Chief of Staff — synthesizes specialists",
};

const es: Table = {
  ...en,
  "nav.dayo.sub": "Tu día",
  "nav.lifevue.sub": "Tu vida en una vista",
  "nav.kinzo.sub": "Inteligencia familiar en movimiento",
  "nav.uplift.sub": "Tus metas, elevadas",
  "nav.vyra.sub": "Jefe de personal",
  "nav.kashu.sub": "Seguro para gastar",
  "nav.vitalu.sub": "Motor de salud",
  "nav.motiveiq.sub": "Patrones, memoria e ideas",
  "nav.signals.sub": "Lo que notó tu IA",
  "nav.connect.sub": "Apps, dispositivos y servicios",
  "nav.settings.sub": "Preferencias y privacidad",
  "nav.group.main": "Apps principales",
  "nav.group.intelligence": "Inteligencia",
  "nav.tasks": "Tareas",
  "nav.learning": "Aprendizaje",
  "nav.career": "Carrera",
  "nav.habits": "Hábitos",
  "nav.relationships": "Relaciones",
  "common.save": "Guardar",
  "common.saved": "Guardado.",
  "common.loading": "Cargando…",
  "common.signOut": "Cerrar sesión",
  "common.closeMenu": "Cerrar menú",
  "common.refresh": "Actualizar",
  "settings.title": "Ajustes",
  "settings.subtitle": "Idioma, moneda y preferencias para todo MotiveLife.",
  "settings.language": "Idioma",
  "settings.languageHint":
    "Se aplica a DayO, LifeVue, KINZO, Kashu, Vitalu, UPLIFT, VYRA y todo tu Modo de Vida.",
  "settings.currency": "Moneda predeterminada",
  "settings.currencyHint": "Para Kashu y vistas de dinero. Puedes cambiarla en Kashu → Reservas.",
  "settings.saveLocale": "Guardar idioma y región",
  "settings.savedLocale": "Idioma y región guardados.",
  "settings.useDevice": "Usar idioma del dispositivo",
  "settings.detected": "Detectado de tu dispositivo",
  "greeting.morning": "Buenos días",
  "greeting.afternoon": "Buenas tardes",
  "greeting.evening": "Buenas noches",
  "greeting.hey": "Hola",
  "tagline.suite": "Una IA. Cada etapa de la vida.",
  "module.vitalu.hero": "Tu salud. Tu plan. Tu vida.",
  "module.kashu.hero": "Sabe qué es seguro antes de gastar",
  "module.kinzo.hero": "Inteligencia familiar en movimiento",
  "module.dayo.hero": "Tu día",
  "module.lifevue.hero": "Tu vida en una vista",
  "module.uplift.hero": "Tus metas, elevadas",
  "module.vyra.hero": "Jefe de personal — sintetiza especialistas",
};

const fr: Table = {
  ...en,
  "nav.dayo.sub": "Votre journée",
  "nav.lifevue.sub": "Votre vie en un coup d'œil",
  "nav.kinzo.sub": "Intelligence familiale en mouvement",
  "nav.uplift.sub": "Vos objectifs, élevés",
  "nav.vyra.sub": "Directrice de cabinet",
  "nav.kashu.sub": "Disponible à dépenser",
  "nav.vitalu.sub": "Moteur santé",
  "nav.motiveiq.sub": "Modèles, mémoire et insights",
  "nav.signals.sub": "Ce que votre IA a remarqué",
  "nav.connect.sub": "Apps, appareils et services",
  "nav.settings.sub": "Préférences et confidentialité",
  "nav.group.main": "Apps principales",
  "nav.group.intelligence": "Intelligence",
  "nav.tasks": "Tâches",
  "nav.learning": "Apprentissage",
  "nav.career": "Carrière",
  "nav.habits": "Habitudes",
  "nav.relationships": "Relations",
  "common.save": "Enregistrer",
  "common.saved": "Enregistré.",
  "common.loading": "Chargement…",
  "common.signOut": "Déconnexion",
  "common.closeMenu": "Fermer le menu",
  "common.refresh": "Actualiser",
  "settings.title": "Paramètres",
  "settings.subtitle": "Langue, devise et préférences pour tout MotiveLife.",
  "settings.language": "Langue",
  "settings.languageHint":
    "S'applique à DayO, LifeVue, KINZO, Kashu, Vitalu, UPLIFT, VYRA et tout votre Mode de Vie.",
  "settings.currency": "Devise par défaut",
  "settings.currencyHint": "Pour Kashu et l'argent. Modifiable dans Kashu → Tampons.",
  "settings.saveLocale": "Enregistrer langue et région",
  "settings.savedLocale": "Langue et région enregistrées.",
  "settings.useDevice": "Langue de l'appareil",
  "settings.detected": "Détecté depuis votre appareil",
  "greeting.morning": "Bonjour",
  "greeting.afternoon": "Bon après-midi",
  "greeting.evening": "Bonsoir",
  "greeting.hey": "Salut",
  "tagline.suite": "Une IA. Chaque étape de la vie.",
  "module.vitalu.hero": "Votre santé. Votre plan. Votre vie.",
  "module.kashu.hero": "Sachez ce qui est sûr avant de dépenser",
  "module.kinzo.hero": "Intelligence familiale en mouvement",
  "module.dayo.hero": "Votre journée",
  "module.lifevue.hero": "Votre vie en un coup d'œil",
  "module.uplift.hero": "Vos objectifs, élevés",
  "module.vyra.hero": "Directrice de cabinet — synthèse des spécialistes",
};

const de: Table = {
  ...en,
  "nav.dayo.sub": "Ihr Tag",
  "nav.lifevue.sub": "Ihr Leben auf einen Blick",
  "nav.kinzo.sub": "Familienintelligenz in Bewegung",
  "nav.uplift.sub": "Ihre Ziele, erhöht",
  "nav.vyra.sub": "Chief of Staff",
  "nav.kashu.sub": "Sicher verfügbar",
  "nav.vitalu.sub": "Gesundheits-Engine",
  "nav.motiveiq.sub": "Muster, Gedächtnis & Erkenntnisse",
  "nav.signals.sub": "Was Ihre KI bemerkte",
  "nav.connect.sub": "Apps, Geräte & Dienste",
  "nav.settings.sub": "Einstellungen & Datenschutz",
  "nav.group.main": "Haupt-Apps",
  "nav.group.intelligence": "Intelligenz",
  "nav.tasks": "Aufgaben",
  "nav.learning": "Lernen",
  "nav.career": "Karriere",
  "nav.habits": "Gewohnheiten",
  "nav.relationships": "Beziehungen",
  "common.save": "Speichern",
  "common.saved": "Gespeichert.",
  "common.loading": "Laden…",
  "common.signOut": "Abmelden",
  "common.closeMenu": "Menü schließen",
  "common.refresh": "Aktualisieren",
  "settings.title": "Einstellungen",
  "settings.subtitle": "Sprache, Währung und Einstellungen für ganz MotiveLife.",
  "settings.language": "Sprache",
  "settings.languageHint":
    "Gilt für DayO, LifeVue, KINZO, Kashu, Vitalu, UPLIFT, VYRA und Ihren gesamten Life Mode.",
  "settings.currency": "Standardwährung",
  "settings.currencyHint": "Für Kashu und Geldansichten. Änderbar unter Kashu → Puffer.",
  "settings.saveLocale": "Sprache & Region speichern",
  "settings.savedLocale": "Sprache und Region gespeichert.",
  "settings.useDevice": "Gerätesprache verwenden",
  "settings.detected": "Vom Gerät erkannt",
  "greeting.morning": "Guten Morgen",
  "greeting.afternoon": "Guten Tag",
  "greeting.evening": "Guten Abend",
  "greeting.hey": "Hey",
  "tagline.suite": "Eine KI. Jede Lebensphase.",
  "module.vitalu.hero": "Ihre Gesundheit. Ihr Plan. Ihr Leben.",
  "module.kashu.hero": "Wissen, was sicher ist, bevor Sie ausgeben",
  "module.kinzo.hero": "Familienintelligenz in Bewegung",
  "module.dayo.hero": "Ihr Tag",
  "module.lifevue.hero": "Ihr Leben auf einen Blick",
  "module.uplift.hero": "Ihre Ziele, erhöht",
  "module.vyra.hero": "Chief of Staff — synthetisiert Spezialisten",
};

const pt: Table = { ...es,
  "nav.dayo.sub": "Seu dia",
  "nav.lifevue.sub": "Sua vida em uma visão",
  "settings.title": "Configurações",
  "settings.subtitle": "Idioma, moeda e preferências para todo o MotiveLife.",
  "settings.languageHint":
    "Aplica-se a DayO, LifeVue, KINZO, Kashu, Vitalu, UPLIFT, VYRA e todo o seu Modo de Vida.",
  "greeting.morning": "Bom dia",
  "greeting.afternoon": "Boa tarde",
  "greeting.evening": "Boa noite",
  "greeting.hey": "Olá",
};

const ar: Table = {
  ...en,
  "nav.dayo": "DayO",
  "nav.lifevue": "LifeVue",
  "nav.kinzo": "KINZO AI",
  "nav.uplift": "UPLIFT",
  "nav.vyra": "VYRA AI",
  "nav.kashu": "Kashu",
  "nav.vitalu": "Vitalu",
  "nav.motiveiq": "MotiveIQ",
  "nav.signals": "الإشارات",
  "nav.connect": "الاتصال",
  "nav.settings": "الإعدادات",
  "nav.dayo.sub": "يومك",
  "nav.lifevue.sub": "حياتك في نظرة واحدة",
  "nav.kinzo.sub": "ذكاء العائلة في حركة",
  "nav.uplift.sub": "أهدافك، مرتفعة",
  "nav.vyra.sub": "رئيس الموظفين",
  "nav.kashu.sub": "آمن للإنفاق",
  "nav.vitalu.sub": "محرك الصحة",
  "nav.motiveiq.sub": "أنماط وذاكرة ورؤى",
  "nav.signals.sub": "ما لاحظته الذكاء الاصطناعي",
  "nav.connect.sub": "التطبيقات والأجهزة والخدمات",
  "nav.settings.sub": "التفضيلات والخصوصية",
  "nav.group.main": "التطبيقات الرئيسية",
  "nav.group.intelligence": "الذكاء",
  "nav.tasks": "المهام",
  "nav.learning": "التعلم",
  "nav.career": "المهنة",
  "nav.habits": "العادات",
  "nav.relationships": "العلاقات",
  "common.save": "حفظ",
  "common.saved": "تم الحفظ.",
  "common.loading": "جاري التحميل…",
  "common.signOut": "تسجيل الخروج",
  "common.closeMenu": "إغلاق القائمة",
  "common.refresh": "تحديث",
  "settings.title": "الإعدادات",
  "settings.subtitle": "اللغة والعملة والتفضيلات لكل MotiveLife.",
  "settings.language": "اللغة",
  "settings.languageHint":
    "ينطبق على DayO وLifeVue وKINZO وKashu وVitalu وUPLIFT وVYRA وكل وضع حياتك.",
  "settings.currency": "العملة الافتراضية",
  "settings.currencyHint": "لـ Kashu وعروض المال. يمكن التغيير في Kashu → الاحتياطي.",
  "settings.saveLocale": "حفظ اللغة والمنطقة",
  "settings.savedLocale": "تم حفظ اللغة والمنطقة.",
  "settings.useDevice": "استخدام لغة الجهاز",
  "settings.detected": "مُكتشف من جهازك",
  "greeting.morning": "صباح الخير",
  "greeting.afternoon": "مساء الخير",
  "greeting.evening": "مساء الخير",
  "greeting.hey": "مرحباً",
  "tagline.suite": "ذكاء واحد. كل مرحلة من الحياة.",
  "module.vitalu.hero": "صحتك. خطتك. حياتك.",
  "module.kashu.hero": "اعرف ما هو آمن قبل الإنفاق",
  "module.kinzo.hero": "ذكاء العائلة في حركة",
  "module.dayo.hero": "يومك",
  "module.lifevue.hero": "حياتك في نظرة واحدة",
  "module.uplift.hero": "أهدافك، مرتفعة",
  "module.vyra.hero": "رئيس الموظفين — يركّب المتخصصين",
};

const ja: Table = {
  ...en,
  "nav.signals": "シグナル",
  "nav.connect": "接続",
  "nav.settings": "設定",
  "nav.dayo.sub": "あなたの一日",
  "nav.lifevue.sub": "人生をひと目で",
  "nav.kinzo.sub": "動く家族インテリジェンス",
  "nav.uplift.sub": "目標を高く",
  "nav.vyra.sub": "チーフ・オブ・スタッフ",
  "nav.kashu.sub": "使ってよい金額",
  "nav.vitalu.sub": "健康オペレーション",
  "nav.motiveiq.sub": "パターン・記憶・洞察",
  "nav.signals.sub": "AIが気づいたこと",
  "nav.connect.sub": "アプリ・デバイス・サービス",
  "nav.settings.sub": "設定とプライバシー",
  "nav.group.main": "メインアプリ",
  "nav.group.intelligence": "インテリジェンス",
  "nav.tasks": "タスク",
  "nav.learning": "学習",
  "nav.career": "キャリア",
  "nav.habits": "習慣",
  "nav.relationships": "人間関係",
  "common.save": "保存",
  "common.saved": "保存しました。",
  "common.loading": "読み込み中…",
  "common.signOut": "サインアウト",
  "common.closeMenu": "メニューを閉じる",
  "common.refresh": "更新",
  "settings.title": "設定",
  "settings.subtitle": "MotiveLife全体の言語・通貨・設定。",
  "settings.language": "言語",
  "settings.languageHint":
    "DayO、LifeVue、KINZO、Kashu、Vitalu、UPLIFT、VYRA などすべてのモードに適用。",
  "settings.currency": "デフォルト通貨",
  "settings.currencyHint": "Kashuとお金の表示に使用。Kashu → バッファで変更可。",
  "settings.saveLocale": "言語と地域を保存",
  "settings.savedLocale": "言語と地域を保存しました。",
  "settings.useDevice": "端末の言語を使用",
  "settings.detected": "端末から検出",
  "greeting.morning": "おはようございます",
  "greeting.afternoon": "こんにちは",
  "greeting.evening": "こんばんは",
  "greeting.hey": "やあ",
  "tagline.suite": "ひとつのAI。人生のすべての段階。",
  "module.vitalu.hero": "あなたの健康。あなたの計画。あなたの人生。",
  "module.kashu.hero": "使う前に安全かどうかを知る",
  "module.kinzo.hero": "動く家族インテリジェンス",
  "module.dayo.hero": "あなたの一日",
  "module.lifevue.hero": "人生をひと目で",
  "module.uplift.hero": "目標を高く",
  "module.vyra.hero": "チーフ・オブ・スタッフ — 専門家を統合",
};

const zh: Table = {
  ...en,
  "nav.signals": "信号",
  "nav.connect": "连接",
  "nav.settings": "设置",
  "nav.dayo.sub": "你的一天",
  "nav.lifevue.sub": "一览人生",
  "nav.kinzo.sub": "流动的家庭智能",
  "nav.uplift.sub": "提升你的目标",
  "nav.vyra.sub": "幕僚长",
  "nav.kashu.sub": "可安全支出",
  "nav.vitalu.sub": "健康引擎",
  "nav.motiveiq.sub": "模式、记忆与洞察",
  "nav.signals.sub": "AI 注意到的事",
  "nav.connect.sub": "应用、设备与服务",
  "nav.settings.sub": "偏好与隐私",
  "nav.group.main": "主应用",
  "nav.group.intelligence": "智能",
  "nav.tasks": "任务",
  "nav.learning": "学习",
  "nav.career": "职业",
  "nav.habits": "习惯",
  "nav.relationships": "关系",
  "common.save": "保存",
  "common.saved": "已保存。",
  "common.loading": "加载中…",
  "common.signOut": "退出登录",
  "common.closeMenu": "关闭菜单",
  "common.refresh": "刷新",
  "settings.title": "设置",
  "settings.subtitle": "MotiveLife 全站的语言、货币与偏好。",
  "settings.language": "语言",
  "settings.languageHint":
    "适用于 DayO、LifeVue、KINZO、Kashu、Vitalu、UPLIFT、VYRA 及所有生活模式。",
  "settings.currency": "默认货币",
  "settings.currencyHint": "用于 Kashu 和金钱视图。可在 Kashu → 缓冲 中更改。",
  "settings.saveLocale": "保存语言与地区",
  "settings.savedLocale": "语言与地区已保存。",
  "settings.useDevice": "使用设备语言",
  "settings.detected": "从设备检测",
  "greeting.morning": "早上好",
  "greeting.afternoon": "下午好",
  "greeting.evening": "晚上好",
  "greeting.hey": "嗨",
  "tagline.suite": "一个 AI。人生的每个阶段。",
  "module.vitalu.hero": "你的健康。你的计划。你的人生。",
  "module.kashu.hero": "消费前知道什么是安全的",
  "module.kinzo.hero": "流动的家庭智能",
  "module.dayo.hero": "你的一天",
  "module.lifevue.hero": "一览人生",
  "module.uplift.hero": "提升你的目标",
  "module.vyra.hero": "幕僚长 — 综合专家意见",
};

const hi: Table = {
  ...en,
  "nav.signals": "सिग्नल",
  "nav.connect": "कनेक्ट",
  "nav.settings": "सेटिंग्स",
  "nav.dayo.sub": "आपका दिन",
  "nav.lifevue.sub": "एक नज़र में आपका जीवन",
  "nav.kinzo.sub": "गतिशील परिवार बुद्धिमत्ता",
  "nav.uplift.sub": "आपके लक्ष्य, ऊँचे",
  "nav.vyra.sub": "मुख्य सहायक",
  "nav.kashu.sub": "खर्च के लिए सुरक्षित",
  "nav.vitalu.sub": "स्वास्थ्य इंजन",
  "nav.motiveiq.sub": "पैटर्न, स्मृति और अंतर्दृष्टि",
  "nav.signals.sub": "आपके AI ने क्या देखा",
  "nav.connect.sub": "ऐप, डिवाइस और सेवाएँ",
  "nav.settings.sub": "प्राथमिकताएँ और गोपनीयता",
  "nav.group.main": "मुख्य ऐप",
  "nav.group.intelligence": "बुद्धिमत्ता",
  "nav.tasks": "कार्य",
  "nav.learning": "सीखना",
  "nav.career": "करियर",
  "nav.habits": "आदतें",
  "nav.relationships": "रिश्ते",
  "common.save": "सहेजें",
  "common.saved": "सहेजा गया।",
  "common.loading": "लोड हो रहा है…",
  "common.signOut": "साइन आउट",
  "common.closeMenu": "मेनू बंद करें",
  "common.refresh": "रीफ़्रेश",
  "settings.title": "सेटिंग्स",
  "settings.subtitle": "पूरे MotiveLife के लिए भाषा, मुद्रा और प्राथमिकताएँ।",
  "settings.language": "भाषा",
  "settings.languageHint":
    "DayO, LifeVue, KINZO, Kashu, Vitalu, UPLIFT, VYRA और आपके सभी लाइफ मोड पर लागू।",
  "settings.currency": "डिफ़ॉल्ट मुद्रा",
  "settings.currencyHint": "Kashu और पैसे के लिए। Kashu → बफ़र में बदलें।",
  "settings.saveLocale": "भाषा और क्षेत्र सहेजें",
  "settings.savedLocale": "भाषा और क्षेत्र सहेजे गए।",
  "settings.useDevice": "डिवाइस भाषा उपयोग करें",
  "settings.detected": "आपके डिवाइस से पता चला",
  "greeting.morning": "सुप्रभात",
  "greeting.afternoon": "नमस्कार",
  "greeting.evening": "शुभ संध्या",
  "greeting.hey": "नमस्ते",
  "tagline.suite": "एक AI। जीवन के हर चरण।",
  "module.vitalu.hero": "आपका स्वास्थ्य। आपकी योजना। आपका जीवन।",
  "module.kashu.hero": "खर्च से पहले जानें क्या सुरक्षित है",
  "module.kinzo.hero": "गतिशील परिवार बुद्धिमत्ता",
  "module.dayo.hero": "आपका दिन",
  "module.lifevue.hero": "एक नज़र में आपका जीवन",
  "module.uplift.hero": "आपके लक्ष्य, ऊँचे",
  "module.vyra.hero": "मुख्य सहायक — विशेषज्ञों को संश्लेषित करता है",
};

const it: Table = {
  ...en,
  "nav.signals": "Segnali",
  "nav.connect": "Connect",
  "nav.settings": "Impostazioni",
  "nav.dayo.sub": "La tua giornata",
  "nav.lifevue.sub": "La tua vita in un colpo d'occhio",
  "nav.kinzo.sub": "Intelligenza familiare in movimento",
  "nav.uplift.sub": "I tuoi obiettivi, elevati",
  "nav.vyra.sub": "Capo di staff",
  "nav.kashu.sub": "Disponibile sicuro",
  "nav.vitalu.sub": "Motore salute",
  "nav.motiveiq.sub": "Schemi, memoria e insight",
  "nav.signals.sub": "Cosa ha notato la tua IA",
  "nav.connect.sub": "App, dispositivi e servizi",
  "nav.settings.sub": "Preferenze e privacy",
  "nav.group.main": "App principali",
  "nav.group.intelligence": "Intelligenza",
  "nav.tasks": "Attività",
  "nav.learning": "Apprendimento",
  "nav.career": "Carriera",
  "nav.habits": "Abitudini",
  "nav.relationships": "Relazioni",
  "common.save": "Salva",
  "common.saved": "Salvato.",
  "common.loading": "Caricamento…",
  "common.signOut": "Esci",
  "common.closeMenu": "Chiudi menu",
  "common.refresh": "Aggiorna",
  "settings.title": "Impostazioni",
  "settings.subtitle": "Lingua, valuta e preferenze per tutto MotiveLife.",
  "settings.language": "Lingua",
  "settings.languageHint":
    "Si applica a DayO, LifeVue, KINZO, Kashu, Vitalu, UPLIFT, VYRA e tutte le modalità vita.",
  "settings.currency": "Valuta predefinita",
  "settings.currencyHint": "Per Kashu e denaro. Modificabile in Kashu → Riserve.",
  "settings.saveLocale": "Salva lingua e regione",
  "settings.savedLocale": "Lingua e regione salvate.",
  "settings.useDevice": "Usa lingua dispositivo",
  "settings.detected": "Rilevato dal dispositivo",
  "greeting.morning": "Buongiorno",
  "greeting.afternoon": "Buon pomeriggio",
  "greeting.evening": "Buonasera",
  "greeting.hey": "Ciao",
  "tagline.suite": "Un'IA. Ogni fase della vita.",
  "module.vitalu.hero": "La tua salute. Il tuo piano. La tua vita.",
  "module.kashu.hero": "Sai cosa è sicuro prima di spendere",
  "module.kinzo.hero": "Intelligenza familiare in movimento",
  "module.dayo.hero": "La tua giornata",
  "module.lifevue.hero": "La tua vita in un colpo d'occhio",
  "module.uplift.hero": "I tuoi obiettivi, elevati",
  "module.vyra.hero": "Capo di staff — sintetizza gli specialisti",
};

const APP_MESSAGES: Record<KashuLocaleCode, Table> = {
  en,
  es,
  fr,
  de,
  pt,
  ar,
  ja,
  zh,
  hi,
  it,
};

export function appT(locale: string, key: AppMessageKey): string {
  const loc = normalizeLocale(locale) as KashuLocaleCode;
  const table = APP_MESSAGES[loc in APP_MESSAGES ? loc : "en"] ?? en;
  return table[key] ?? APP_MESSAGES.en[key] ?? key;
}

export function localizedGreeting(locale: string, hour = new Date().getHours()): string {
  if (hour < 12) return appT(locale, "greeting.morning");
  if (hour < 17) return appT(locale, "greeting.afternoon");
  return appT(locale, "greeting.evening");
}
