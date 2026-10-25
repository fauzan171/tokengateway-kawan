/** Locale bundles for the agent-preset hero chip, header label, and management section. */

import { guideEn, guideJa, guideEs, guideFr, guideDe, guideRu, guidePt, guideZh, type PresetGuideKey } from './guide-locales.ts'

/** Locale keys these surfaces render. */
export type AgentPresetSettingsKey =
  | PresetGuideKey
  | 'builtInGroup'
  | 'customGroup'
  | 'seatHint'
  | 'headerHint'
  | 'nav'
  | 'sectionIntro'
  | 'setDefault'
  | 'view'
  | 'presetStandardName'
  | 'presetStandardDescription'
  | 'presetPtcName'
  | 'presetPtcDescription'
  | 'presetMinimalName'
  | 'presetMinimalDescription'
  | 'presetCordisName'
  | 'presetCordisDescription'
  | 'presetChatName'
  | 'presetChatDescription'
  | 'presetRisetName'
  | 'presetRisetDescription'
  | 'presetDataName'
  | 'presetDataDescription'
  | 'presetMarketingName'
  | 'presetMarketingDescription'
  | 'inUse'
  | 'noDescription'
  | 'brokenBadge'
  | 'switchRefused'
  | 'standardUnavailable'
  | 'close'
  | 'creatorDraft'
  | 'createPlugin'
  | 'createPluginDescription'
  | 'createPluginChecking'
  | 'createPluginUnavailable'
  | 'createPluginMissing'

/** English copy. */
export const en: Record<AgentPresetSettingsKey, string> = {
  ...guideEn,
  builtInGroup: 'Built-in', customGroup: 'Custom',
  sectionIntro: 'Choose the agent’s tools and how it works. Use Standard mode for everyday tasks, or Creator mode to add capabilities to DSH.',

  seatHint: 'Choose the agent preset for your new task',
  headerHint: 'The agent preset chosen when this task started',
  nav: 'Agent presets',

  setDefault: 'Set as new task default',
  view: 'View configuration',

  presetStandardName: 'Standard mode',
  presetStandardDescription:
    'Work with code, files, and information. Suitable for most tasks, with search, editing, terminal commands, and other tools available as needed.',
  presetPtcName: 'PTC mode',
  presetPtcDescription:
    'Includes all Standard mode capabilities. Better suited to tasks that call tools in batches and then filter, organize, deduplicate, count, or summarize the results.',
  presetMinimalName: 'Minimal mode',
  presetMinimalDescription:
    'The agent uses a terminal and image reading, with context compaction. Useful for testing and comparing its basic performance.',
  presetCordisName: 'Creator mode',
  presetCordisDescription:
    'Customize DSH through conversation. Let the agent write plugins that add features or UI, or combine tools and prompts to create your own mode.',
  presetChatName: 'Chat mode',
  presetChatDescription:
    'Everyday conversation: questions and answers, writing, summarizing, and presenting results. Can open web pages you provide.',
  presetRisetName: 'Research mode',
  presetRisetDescription:
    'Web research: gathers and compares information, presents results with verifiable sources, and keeps facts, inference, and unverified claims separate.',
  presetDataName: 'Data mode',
  presetDataDescription:
    'Data analysis: reads CSV/JSON/Excel files, inspects structure, cleans, computes, and presents results; file outputs can be downloaded when processing is available.',
  presetMarketingName: 'Marketing mode',
  presetMarketingDescription:
    'Business and marketing analysis: positioning, strategy, campaign ideas, and evaluation from material you provide or web sources.',

  inUse: 'New task default',

  noDescription: 'No description.',
  brokenBadge: 'Failed to load',

  switchRefused: 'Could not switch to {name}: {reason}',
  standardUnavailable: 'Standard mode is unavailable. Restore it or choose another available mode.',

  close: 'Close',

  creatorDraft: 'Let the agent help me create a preset',
  createPlugin: 'Let the agent create a plugin',
  createPluginDescription: 'Enter Creator mode and make your own DSH plugin',
  createPluginChecking: 'Checking whether Creator mode is available',
  createPluginUnavailable: 'Temporarily unavailable. Reopen this menu to retry',
  createPluginMissing: 'Creator mode is not included in this configuration',

}

/** Simplified Chinese copy. */
export const zh: Record<AgentPresetSettingsKey, string> = {
  ...guideZh,
  builtInGroup: '内置', customGroup: '自定义',
  sectionIntro: '选择 Agent 的工具和工作方式。日常任务用「标准模式」，扩展 DSH 的能力用「创造模式」。',

  seatHint: '选择新任务使用的 Agent 预设',
  headerHint: '本任务的 Agent 预设，在任务开始时确定',
  nav: 'Agent 预设',

  setDefault: '设为新任务默认',
  view: '查看配置',

  presetStandardName: '标准模式',
  presetStandardDescription: '处理代码、文件和资料，适合大多数任务。Agent 会按需使用检索、编辑和终端等工具。',
  presetPtcName: 'PTC 模式',
  presetPtcDescription: '包含标准模式的所有能力，更适合批量调用工具，并对结果进行筛选、整理、去重、统计或汇总的任务。',
  presetMinimalName: '极简模式',
  presetMinimalDescription: 'Agent 使用终端和图片读取工具，并支持上下文压缩，适合测试和对比其基础表现。',
  presetCordisName: '创造模式',
  presetCordisDescription: '用对话定制 DSH：让 Agent 编写插件，添加新功能或界面；也能组合工具和提示词，创建自己的模式。',
  presetChatName: '对话模式',
  presetChatDescription: '日常交流：问答、写作、总结和呈现结果，可打开你提供的网页。',
  presetRisetName: '调研模式',
  presetRisetDescription: '网络调研：收集并比较信息，以可核对的来源呈现结果，区分事实、推断和未经证实的说法。',
  presetDataName: '数据模式',
  presetDataDescription: '数据分析：读取 CSV/JSON/Excel 文件，检查结构、清洗、计算并呈现结果；具备处理能力时可下载文件结果。',
  presetMarketingName: '营销模式',
  presetMarketingDescription: '商业与营销分析：定位、策略、活动创意，基于你提供的材料或网络来源进行评估。',

  inUse: '新任务默认',

  noDescription: '暂无描述。',
  brokenBadge: '加载失败',

  switchRefused: '无法切换到「{name}」：{reason}',
  standardUnavailable: '标准模式不可用，请恢复该模式或选择其他可用模式。',

  close: '关闭',

  creatorDraft: '让 Agent 帮我创建预设模式',
  createPlugin: '让 Agent 创建插件',
  createPluginDescription: '进入创造模式，制作属于你的 DSH 插件',
  createPluginChecking: '正在确认创造模式是否可用',
  createPluginUnavailable: '暂时不可用，请重新打开菜单重试',
  createPluginMissing: '当前配置未提供创造模式',

}

// The resolution itself is the shared fold in `dsh-agent-preset-registry/display`,
// re-exported here so every surface in this plugin reads one path; the
// Settings plugin list inlines the same fold over this plugin's dictionaries.
export { isBuiltInPreset, presetDisplayText } from '@deepseek-ai/dsh-agent-preset-registry/display'
export type { PresetDisplaySource, PresetDisplayText } from '@deepseek-ai/dsh-agent-preset-registry/display'

/** Japanese copy, checked against the English keys. */
export const ja = {
  ...guideJa,
  'builtInGroup': '組み込み',
  'customGroup': 'カスタム',
  'sectionIntro': 'エージェントのツールと動作を選択します。日々のタスクには標準モードを、DSH に機能を追加するにはクリエイターモードを使用してください。',
  'seatHint': '新しいタスクで使用するエージェントプリセットを選択',
  'headerHint': 'このタスクの開始時に選択されたエージェントプリセット',
  'nav': 'エージェントプリセット',
  'setDefault': '新しいタスクの既定に設定',
  'view': '設定を表示',
  'presetStandardName': '標準モード',
  'presetStandardDescription': 'コード、ファイル、情報を扱います。検索、編集、ターミナルコマンドなどのツールを必要に応じて利用でき、ほとんどのタスクに適しています。',
  'presetPtcName': 'PTC モード',
  'presetPtcDescription': '標準モードのすべての機能を含みます。ツールを一括で呼び出し、その結果を絞り込み、整理、重複排除、集計、要約するタスクに適しています。',
  'presetMinimalName': '最小モード',
  'presetMinimalDescription': 'エージェントはターミナルと画像読み取りを使用し、コンテキスト圧縮にも対応します。基本的な性能のテストや比較に役立ちます。',
  'presetCordisName': 'クリエイターモード',
  'presetCordisDescription': '会話を通じて DSH をカスタマイズします。機能や UI を追加するプラグインをエージェントに書かせたり、ツールとプロンプトを組み合わせて独自のモードを作成したりできます。',
  'presetChatName': 'チャットモード',
  'presetChatDescription': '日常の会話：質疑応答、文章作成、要約、結果の提示を行います。指定されたウェブページを開けます。',
  'presetRisetName': 'リサーチモード',
  'presetRisetDescription': 'ウェブ調査：情報を収集して比較し、検証可能な出典付きで結果をまとめ、事実・推論・未検証の主張を区別します。',
  'presetDataName': 'データモード',
  'presetDataDescription': 'データ分析：CSV/JSON/Excel ファイルを読み込み、構造の確認、クリーニング、計算、結果の提示を行います。処理環境があればファイル結果をダウンロードできます。',
  'presetMarketingName': 'マーケティングモード',
  'presetMarketingDescription': 'ビジネス・マーケティング分析：ポジショニング、戦略、キャンペーン案を、提供された資料やウェブ情報に基づいて評価します。',
  'inUse': '新しいタスクの既定',
  'noDescription': '説明はありません。',
  'brokenBadge': '読み込みに失敗',
  'switchRefused': '{name} に切り替えられませんでした: {reason}',
  'standardUnavailable': '標準モードは利用できません。復元するか、利用可能な別のモードを選択してください。',
  'close': '閉じる',
  'creatorDraft': 'エージェントにプリセット作成を手伝ってもらう',
  'createPlugin': 'エージェントにプラグインを作成してもらう',
  'createPluginDescription': 'クリエイターモードに入り、独自の DSH プラグインを作成',
  'createPluginChecking': 'クリエイターモードが利用可能か確認中',
  'createPluginUnavailable': '一時的に利用できません。このメニューを開き直して再試行してください',
  'createPluginMissing': 'この構成にはクリエイターモードが含まれていません',
} satisfies Record<keyof typeof en, string>

/** Spanish dictionary, checked against the English keys. */
export const es = {
  ...guideEs,
  builtInGroup: 'Incorporado', customGroup: 'personalizado',
  sectionIntro: 'Elija las herramientas del agente y cómo funciona. Utilice el modo Estándar para las tareas diarias o el modo Creador para agregar capacidades a DSH.',

  seatHint: 'Elija el agente preestablecido para su nueva tarea',
  headerHint: 'El agente preestablecido elegido cuando comenzó esta tarea',
  nav: 'Ajustes preestablecidos del agente',

  setDefault: 'Establecer como nueva tarea predeterminada',
  view: 'Ver configuración',

  presetStandardName: 'Modo estándar',
  presetStandardDescription:
    'Trabaje con código, archivos e información. Adecuado para la mayoría de las tareas, con búsqueda, edición, comandos de terminal y otras herramientas disponibles según sea necesario.',
  presetPtcName: 'Modo PTC',
  presetPtcDescription:
    'Incluye todas las capacidades del modo Estándar. Más adecuado para tareas que llaman a herramientas en lotes y luego filtran, organizan, deduplican, cuentan o resumen los resultados.',
  presetMinimalName: 'modo mínimo',
  presetMinimalDescription:
    'El agente utiliza un terminal y lectura de imágenes, con compactación de contexto. Útil para probar y comparar su rendimiento básico.',
  presetCordisName: 'Modo creador',
  presetCordisDescription:
    'Personaliza DSH a través de la conversación. Deje que el agente escriba complementos que agreguen funciones o interfaz de usuario, o combine herramientas e indicaciones para crear su propio modo.',
  presetChatName: 'Modo chat',
  presetChatDescription:
    'Conversación diaria: preguntas y respuestas, escritura, resúmenes y presentación de resultados. Puede abrir páginas web que usted proporcione.',
  presetRisetName: 'Modo de investigación',
  presetRisetDescription:
    'Investigación web: recopila y compara información, presenta resultados con fuentes verificables y distingue hechos, inferencias y afirmaciones no verificadas.',
  presetDataName: 'Modo de datos',
  presetDataDescription:
    'Análisis de datos: lee archivos CSV/JSON/Excel, examina la estructura, limpia, calcula y presenta resultados; los archivos resultantes se pueden descargar cuando el procesamiento está disponible.',
  presetMarketingName: 'Modo de marketing',
  presetMarketingDescription:
    'Análisis de negocios y marketing: posicionamiento, estrategia, ideas de campaña y evaluación a partir del material que usted proporcione o de fuentes web.',

  inUse: 'Nueva tarea predeterminada',

  noDescription: 'Sin descripción.',
  brokenBadge: 'No se pudo cargar',

  switchRefused: 'No se pudo cambiar a {name}: {reason}',
  standardUnavailable: 'El modo estándar no está disponible. Restáuralo o elige otro modo disponible.',

  close: 'Cerrar',

  creatorDraft: 'Deja que el agente me ayude a crear un preset',
  createPlugin: 'Deje que el agente cree un complemento',
  createPluginDescription: 'Ingrese al modo Creador y cree su propio complemento DSH',
  createPluginChecking: 'Comprobando si el modo Creador está disponible',
  createPluginUnavailable: 'Temporalmente no disponible. Vuelve a abrir este menú para volver a intentarlo.',
  createPluginMissing: 'El modo creador no está incluido en esta configuración.',

} satisfies Record<keyof typeof en, string>

/** French dictionary, checked against the English keys. */
export const fr = {
  ...guideFr,
  builtInGroup: 'Intégré', customGroup: 'Personnalisé',
  sectionIntro: 'Choisissez les outils de l’agent et son fonctionnement. Utilisez le mode Standard pour les tâches quotidiennes ou le mode Créateur pour ajouter des fonctionnalités à DSH.',

  seatHint: "Choisissez le préréglage d'agent pour votre nouvelle tâche",
  headerHint: "Le préréglage d'agent choisi au démarrage de cette tâche",
  nav: "Préréglages d'agent",

  setDefault: 'Définir comme nouvelle tâche par défaut',
  view: 'Afficher la configuration',

  presetStandardName: 'Mode standard',
  presetStandardDescription:
    'Travaillez avec du code, des fichiers et des informations. Convient à la plupart des tâches, avec recherche, édition, commandes de terminal et autres outils disponibles selon les besoins.',
  presetPtcName: 'Mode PTC',
  presetPtcDescription:
    'Inclut toutes les fonctionnalités du mode Standard. Mieux adapté aux tâches qui appellent des outils par lots, puis filtrent, organisent, dédupliquent, comptent ou résument les résultats.',
  presetMinimalName: 'Mode minimal',
  presetMinimalDescription:
    "L'agent utilise un terminal et une lecture d'image, avec compactage du contexte. Utile pour tester et comparer ses performances de base.",
  presetCordisName: 'Mode Créateur',
  presetCordisDescription:
    "Personnalisez DSH via la conversation. Laissez l'agent écrire des plugins qui ajoutent des fonctionnalités ou une interface utilisateur, ou combinez des outils et des invites pour créer votre propre mode.",
  presetChatName: 'Mode conversation',
  presetChatDescription:
    'Conversation quotidienne : questions-réponses, rédaction, synthèse et présentation de résultats. Peut ouvrir les pages web que vous fournissez',
  presetRisetName: 'Mode recherche',
  presetRisetDescription:
    'Recherche web : rassemble et compare des informations, présente les résultats avec des sources vérifiables et distingue les faits, les inférences et les affirmations non vérifiées.',
  presetDataName: 'Mode données',
  presetDataDescription:
    'Analyse de données : lit les fichiers CSV/JSON/Excel, examine la structure, nettoie, calcule et présente les résultats ; les fichiers produits peuvent être téléchargés lorsque le traitement est disponible.',
  presetMarketingName: 'Mode marketing',
  presetMarketingDescription:
    'Analyse business et marketing : positionnement, stratégie, idées de campagne et évaluation à partir du matériel que vous fournissez ou de sources web',

  inUse: 'Nouvelle tâche par défaut',

  noDescription: 'Aucune description.',
  brokenBadge: 'Échec du chargement',

  switchRefused: 'Impossible de passer à {name} : {reason}',
  standardUnavailable: "Le mode standard n'est pas disponible. Restaurez-le ou choisissez un autre mode disponible.",

  close: 'Fermer',

  creatorDraft: "Laissez l'agent m'aider à créer un préréglage",
  createPlugin: "Laissez l'agent créer un plugin",
  createPluginDescription: 'Entrez en mode Créateur et créez votre propre plugin DSH',
  createPluginChecking: 'Vérifier si le mode Créateur est disponible',
  createPluginUnavailable: 'Temporairement indisponible. Rouvrez ce menu pour réessayer',
  createPluginMissing: "Le mode Créateur n'est pas inclus dans cette configuration",

} satisfies Record<keyof typeof en, string>

/** German dictionary, checked against the English keys. */
export const de = {
  ...guideDe,
  builtInGroup: 'Eingebaut', customGroup: 'Benutzerdefiniert',
  sectionIntro: 'Wählen Sie die Tools des Agenten und deren Funktionsweise aus. Verwenden Sie den Standardmodus für alltägliche Aufgaben oder den Creator-Modus, um DSH Funktionen hinzuzufügen.',

  seatHint: 'Wählen Sie die Agentenvoreinstellung für Ihre neue Aufgabe',
  headerHint: 'Die Agentenvoreinstellung, die beim Start dieser Aufgabe ausgewählt wurde',
  nav: 'Agentenvoreinstellungen',

  setDefault: 'Als Standard für neue Aufgabe festlegen',
  view: 'Konfiguration anzeigen',

  presetStandardName: 'Standardmodus',
  presetStandardDescription:
    'Arbeiten Sie mit Code, Dateien und Informationen. Geeignet für die meisten Aufgaben, da bei Bedarf Suche, Bearbeitung, Terminalbefehle und andere Tools verfügbar sind.',
  presetPtcName: 'PTC-Modus',
  presetPtcDescription:
    'Beinhaltet alle Funktionen des Standardmodus. Besser geeignet für Aufgaben, bei denen Tools stapelweise aufgerufen und die Ergebnisse dann gefiltert, organisiert, dedupliziert, gezählt oder zusammengefasst werden.',
  presetMinimalName: 'Minimalmodus',
  presetMinimalDescription:
    'Der Agent verwendet ein Terminal und das Lesen von Bildern mit Kontextkomprimierung. Nützlich zum Testen und Vergleichen der Grundleistung.',
  presetCordisName: 'Erstellermodus',
  presetCordisDescription:
    'Passen Sie DSH durch Gespräche an. Lassen Sie den Agenten Plugins schreiben, die Funktionen oder Benutzeroberflächen hinzufügen, oder kombinieren Sie Tools und Eingabeaufforderungen, um Ihren eigenen Modus zu erstellen.',
  presetChatName: 'Chatmodus',
  presetChatDescription:
    'Alltagsgespräche: Fragen und Antworten, Schreiben, Zusammenfassen und Präsentieren von Ergebnissen. Kann von Ihnen angegebene Webseiten öffnen.',
  presetRisetName: 'Recherche-Modus',
  presetRisetDescription:
    'Webrecherche: sammelt und vergleicht Informationen, stellt Ergebnisse mit überprüfbaren Quellen dar und trennt Fakten, Schlussfolgerungen und unbelegte Aussagen.',
  presetDataName: 'Datenmodus',
  presetDataDescription:
    'Datenanalyse: liest CSV/JSON/Excel-Dateien, prüft die Struktur, bereinigt, berechnet und stellt Ergebnisse dar; Dateiausgaben können heruntergeladen werden, wenn die Verarbeitung verfügbar ist.',
  presetMarketingName: 'Marketingmodus',
  presetMarketingDescription:
    'Business- und Marketinganalyse: Positionierung, Strategie, Kampagnenideen und Bewertung anhand des von Ihnen bereitgestellten Materials oder aus Webquellen.',

  inUse: 'Neuer Aufgabenstandard',

  noDescription: 'Keine Beschreibung.',
  brokenBadge: 'Laden fehlgeschlagen',

  switchRefused: 'Konnte nicht zu {name} wechseln: {reason}',
  standardUnavailable: 'Der Standardmodus ist nicht verfügbar. Stellen Sie es wieder her oder wählen Sie einen anderen verfügbaren Modus.',

  close: 'Schließen',

  creatorDraft: 'Lassen Sie sich vom Agenten beim Erstellen einer Voreinstellung helfen',
  createPlugin: 'Lassen Sie den Agenten ein Plugin erstellen',
  createPluginDescription: 'Wechseln Sie in den Erstellermodus und erstellen Sie Ihr eigenes DSH-Plugin',
  createPluginChecking: 'Prüfen, ob der Creator-Modus verfügbar ist',
  createPluginUnavailable: 'Vorübergehend nicht verfügbar. Öffnen Sie dieses Menü erneut, um es erneut zu versuchen',
  createPluginMissing: 'Der Creator-Modus ist in dieser Konfiguration nicht enthalten',

} satisfies Record<keyof typeof en, string>

/** Russian dictionary, checked against the English keys. */
export const ru = {
  ...guideRu,
  builtInGroup: 'Встроенный', customGroup: 'Пользовательский',
  sectionIntro: 'Выбирайте инструменты агента и то, как они работают. Используйте стандартный режим для повседневных задач или режим Creator, чтобы расширить возможности DSH.',

  seatHint: 'Выберите предустановку агента для вашей новой задачи',
  headerHint: 'Предварительная настройка агента, выбранная при запуске этой задачи',
  nav: 'Настройки агента',

  setDefault: 'Установить в качестве новой задачи по умолчанию',
  view: 'Посмотреть конфигурацию',

  presetStandardName: 'Стандартный режим',
  presetStandardDescription:
    'Работайте с кодом, файлами и информацией. Подходит для большинства задач, с поиском, редактированием, командами терминала и другими инструментами, доступными по мере необходимости.',
  presetPtcName: 'Режим PTC',
  presetPtcDescription:
    'Включает все возможности стандартного режима. Лучше подходит для задач, которые вызывают инструменты в пакетном режиме, а затем фильтруют, организуют, дедуплицируют, подсчитывают или суммируют результаты.',
  presetMinimalName: 'Минимальный режим',
  presetMinimalDescription:
    'Агент использует терминал и чтение изображений со сжатием контекста. Полезно для тестирования и сравнения его базовой производительности.',
  presetCordisName: 'Режим автора',
  presetCordisDescription:
    'Настройте DSH через разговор. Позвольте агенту писать плагины, которые добавляют функции или пользовательский интерфейс, или комбинируйте инструменты и подсказки для создания собственного режима.',
  presetChatName: 'Режим чата',
  presetChatDescription:
    'Повседневное общение: вопросы и ответы, написание текстов, краткие сводки и представление результатов. Может открывать указанные вами веб-страницы.',
  presetRisetName: 'Режим исследования',
  presetRisetDescription:
    'Веб-исследование: собирает и сравнивает информацию, представляет результаты с проверяемыми источниками и разделяет факты, выводы и неподтверждённые утверждения.',
  presetDataName: 'Режим данных',
  presetDataDescription:
    'Анализ данных: читает файлы CSV/JSON/Excel, проверяет структуру, очищает, вычисляет и представляет результаты; файлы можно скачать, когда обработка доступна.',
  presetMarketingName: 'Режим маркетинга',
  presetMarketingDescription:
    'Бизнес- и маркетинговый анализ: позиционирование, стратегия, идеи кампаний и оценка на основе ваших материалов или веб-источников.',

  inUse: 'Новая задача по умолчанию',

  noDescription: 'Нет описания.',
  brokenBadge: 'Не удалось загрузить',

  switchRefused: 'Не удалось переключиться на {name}: {reason}',
  standardUnavailable: 'Стандартный режим недоступен. Восстановите его или выберите другой доступный режим.',

  close: 'Закрыть',

  creatorDraft: 'Позвольте агенту помочь мне создать пресет',
  createPlugin: 'Позвольте агенту создать плагин',
  createPluginDescription: 'Войдите в режим Creator и создайте свой собственный плагин DSH.',
  createPluginChecking: 'Проверка доступности режима Creator',
  createPluginUnavailable: 'Временно недоступен. Откройте это меню еще раз, чтобы повторить попытку.',
  createPluginMissing: 'Режим Creator не включен в эту конфигурацию.',

} satisfies Record<keyof typeof en, string>

/** Portuguese dictionary, checked against the English keys. */
export const pt = {
  ...guidePt,
  builtInGroup: 'Integrado', customGroup: 'Personalizado',
  sectionIntro: 'Escolha as ferramentas do agente e como funciona. Use o modo Padrão para tarefas diárias ou o modo Criador para adicionar recursos ao DSH.',

  seatHint: 'Escolha a predefinição de agente para sua nova tarefa',
  headerHint: 'A predefinição do agente escolhida quando esta tarefa foi iniciada',
  nav: 'Predefinições de agente',

  setDefault: 'Definir como nova tarefa padrão',
  view: 'Ver configuração',

  presetStandardName: 'Modo padrão',
  presetStandardDescription:
    'Trabalhe com código, arquivos e informações. Adequado para a maioria das tarefas, com pesquisa, edição, comandos de terminal e outras ferramentas disponíveis conforme necessário.',
  presetPtcName: 'modo PTC',
  presetPtcDescription:
    'Inclui todos os recursos do modo Padrão. Mais adequado para tarefas que chamam ferramentas em lotes e depois filtram, organizam, desduplicam, contam ou resumem os resultados.',
  presetMinimalName: 'Modo mínimo',
  presetMinimalDescription:
    'O agente utiliza terminal e leitura de imagens, com compactação de contexto. Útil para testar e comparar seu desempenho básico.',
  presetCordisName: 'Modo criador',
  presetCordisDescription:
    'Personalize DSH por meio de conversa. Deixe o agente escrever plug-ins que adicionem recursos ou UI, ou combine ferramentas e prompts para criar seu próprio modo.',
  presetChatName: 'Modo conversa',
  presetChatDescription:
    'Conversa do dia a dia: perguntas e respostas, escrita, resumos e apresentação de resultados. Pode abrir páginas web que você fornecer.',
  presetRisetName: 'Modo de pesquisa',
  presetRisetDescription:
    'Pesquisa na web: reúne e compara informações, apresenta resultados com fontes verificáveis e distingue fatos, inferências e afirmações não verificadas.',
  presetDataName: 'Modo de dados',
  presetDataDescription:
    'Análise de dados: lê arquivos CSV/JSON/Excel, examina a estrutura, limpa, calcula e apresenta resultados; arquivos resultantes podem ser baixados quando o processamento está disponível.',
  presetMarketingName: 'Modo de marketing',
  presetMarketingDescription:
    'Análise de negócios e marketing: posicionamento, estratégia, ideias de campanha e avaliação a partir do material que você fornecer ou de fontes da web.',

  inUse: 'Novo padrão de tarefa',

  noDescription: 'Nenhuma descrição.',
  brokenBadge: 'Falha ao carregar',

  switchRefused: 'Não foi possível mudar para {name}: {reason}',
  standardUnavailable: 'O modo padrão não está disponível. Restaure-o ou escolha outro modo disponível.',

  close: 'Fechar',

  creatorDraft: 'Deixe o agente me ajudar a criar uma predefinição',
  createPlugin: 'Deixe o agente criar um plugin',
  createPluginDescription: 'Entre no modo Criador e crie seu próprio plug-in DSH',
  createPluginChecking: 'Verificando se o modo Criador está disponível',
  createPluginUnavailable: 'Temporariamente indisponível. Reabra este menu para tentar novamente',
  createPluginMissing: 'O modo criador não está incluído nesta configuração',

} satisfies Record<keyof typeof en, string>
