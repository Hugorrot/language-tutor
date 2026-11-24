// Interface translations. The whole UI follows the learner's explanation language;
// the conversation and the card sentences stay in the language being learned.
//
// In HTML:  data-i18n="key"        -> textContent
//           data-i18n-html="key"   -> innerHTML (only for our own strings with <kbd>)
//           data-i18n-ph="key"     -> placeholder
//           data-i18n-title="key"  -> title and aria-label
//           data-lang-options      -> <select> filled with the languages, names translated
// In JS:    t("key", { var: value }), langName("French"), onUiLanguageChange(callback)

const LANGS = ["Italian", "Spanish", "French", "English", "German", "Portuguese"];
const CODES = { English: "en", Italian: "it", Spanish: "es", French: "fr", German: "de", Portuguese: "pt" };

// Language names in each interface language (order of LANGS)
const NAMES = {
  English:    ["Italian", "Spanish", "French", "English", "German", "Portuguese"],
  Italian:    ["Italiano", "Spagnolo", "Francese", "Inglese", "Tedesco", "Portoghese"],
  Spanish:    ["Italiano", "Español", "Francés", "Inglés", "Alemán", "Portugués"],
  French:     ["Italien", "Espagnol", "Français", "Anglais", "Allemand", "Portugais"],
  German:     ["Italienisch", "Spanisch", "Französisch", "Englisch", "Deutsch", "Portugiesisch"],
  Portuguese: ["Italiano", "Espanhol", "Francês", "Inglês", "Alemão", "Português"],
};
// Inside a sentence these languages write language names in lowercase ("in francese")
const LOWERCASE_IN_SENTENCE = new Set(["Italian", "Spanish", "French", "Portuguese"]);

const STRINGS = {
  English: {
    nav_talk: "Talk", nav_review: "Review", nav_progress: "Progress",
    welcome: "Welcome", onb_title: "Let's get you talking.",
    onb_sub: "A voice tutor that remembers your mistakes and turns them into practice.",
    your_name: "Your name", want_learn: "I want to learn", explanations_in: "Explanations in", my_goal: "My goal",
    goal_ph: "Erasmus, travel, work...", start: "Start",
    new_session: "New session", setup_title: "What do you want to practise?", language: "Language", topic: "Topic",
    start_session: "Start session", starting: "Starting…",
    sc_free: "Free conversation", sc_free_sub: "Chat about anything",
    sc_rest: "At a restaurant", sc_rest_sub: "Menu, allergies, the bill",
    sc_flat: "Renting a flat", sc_flat_sub: "Rooms, rent, landlords",
    sc_weekend: "Your weekend", sc_weekend_sub: "Tell a friend what you did",
    sc_dir: "Directions", sc_dir_sub: "Streets, stations, maps",
    talk_hint: "Hold the button or the <kbd>space</kbd> bar to talk", type_here: "...or type here", send: "Send",
    transcript: "Transcript", hold_to_talk: "Hold to talk", end_session: "End session", close: "Close",
    st_idle: "Hold to talk", st_listening: "Listening…", st_thinking: "Thinking…", st_speaking: "Speaking",
    err_prefix: "Error: ", too_short: "Too short: hold while you speak.", mic_unavailable: "Microphone not available: ",
    cant_hear: "I couldn't hear anything. Hold the button while you speak, a bit closer to the mic.",
    analysing: "Analysing your session…", expl_changed: "Explanations will now be in {lang}.",
    session_complete: "Session complete", how_it_went: "How it went", your_mistakes: "Your mistakes", new_cards: "New cards",
    remove_hint: "Remove any card you don't want. The rest are in your Review tab.", new_session_btn: "New session",
    no_learner_msgs: "No learner messages in this session.", no_mistakes: "No mistakes found. Bravo!",
    no_new_cards: "No new cards: mistakes you already have cards for were moved back into review.", remove: "Remove",
    all_caught_up: "All caught up", nothing_due: "Nothing to review right now. Come back later!",
    play_audio: "Play audio", dont_know: "I don't know: show answer",
    rating_help: "How well did you know it? This decides when the card comes back.",
    again: "Again", hard: "Hard", good: "Good", easy: "Easy",
    again_t: "Didn't know it: see it again in a few minutes", hard_t: "Got it with difficulty", good_t: "Got it",
    easy_t: "Too easy: wait longer", check: "Check",
    leave_title: "Leave the conversation?", leave_body: "What you said so far will not be analysed.", btn_leave: "Leave", btn_cancel: "Cancel",
    kind_cloze: "Fill the gap", kind_vocab: "Vocabulary", kind_reverse: "Translate",
    ph_cloze: "Type the missing word(s)…", ph_vocab: "What does it mean?", ph_reverse: "Write it in {lang}…",
    fb_correct: "Correct!", fb_accent: "Almost: check the accents.", fb_wrong: "Not quite. The answer is:",
    fb_skipped: "The answer is:", fb_selfcheck: "Compare with the answer:", you_wrote: "You wrote “{answer}”.",
    you_said: "You said",
    most_frequent: "Most frequent mistakes",
    grouped_hint: "Similar mistakes are grouped together, even when they were explained with different words. Click one to see every sentence where you made it.", loading: "Loading…",
    search_title: "Search what you said", search_btn: "Search",
    search_hint: "A word or a topic, e.g. football, my friend, the weekend…", searching: "Searching…",
    said_one: "You said “{q}” {n} time in {lang}.", said_other: "You said “{q}” {n} times in {lang}.",
    similar_things: "Similar things you said:", pct_similar: "{n}% similar",
    level_title: "{lang} · Level {level}",
    s_sessions: "Sessions", s_minutes: "Minutes spoken (est.)", s_accuracy: "Review accuracy", s_cards: "Cards",
    s_due: "Due now", s_level: "Level",
    no_lang_mistakes: "No {lang} mistakes yet. Have a conversation first.", fixed: "fixed", in_sessions: "{n} sessions",
  },

  Italian: {
    nav_talk: "Parla", nav_review: "Ripasso", nav_progress: "Progressi",
    welcome: "Ciao", onb_title: "Iniziamo a parlare.",
    onb_sub: "Un tutor vocale che ricorda i tuoi errori e li trasforma in esercizi.",
    your_name: "Il tuo nome", want_learn: "Voglio imparare", explanations_in: "Spiegazioni in", my_goal: "Il mio obiettivo",
    goal_ph: "Erasmus, viaggi, lavoro...", start: "Inizia",
    new_session: "Nuova sessione", setup_title: "Cosa vuoi praticare?", language: "Lingua", topic: "Argomento",
    start_session: "Inizia la sessione", starting: "Avvio…",
    sc_free: "Conversazione libera", sc_free_sub: "Parla di quello che vuoi",
    sc_rest: "Al ristorante", sc_rest_sub: "Menù, allergie, il conto",
    sc_flat: "Affittare casa", sc_flat_sub: "Stanze, affitto, proprietari",
    sc_weekend: "Il tuo weekend", sc_weekend_sub: "Racconta a un amico cosa hai fatto",
    sc_dir: "Indicazioni", sc_dir_sub: "Strade, stazioni, mappe",
    talk_hint: "Tieni premuto il pulsante o la <kbd>barra spaziatrice</kbd> per parlare", type_here: "...oppure scrivi qui",
    send: "Invia", transcript: "Trascrizione", hold_to_talk: "Tieni premuto per parlare", end_session: "Termina la sessione",
    close: "Chiudi",
    st_idle: "Tieni premuto per parlare", st_listening: "Ti ascolto…", st_thinking: "Sto pensando…", st_speaking: "Sto parlando",
    err_prefix: "Errore: ", too_short: "Troppo breve: tieni premuto mentre parli.", mic_unavailable: "Microfono non disponibile: ",
    cant_hear: "Non ho sentito niente. Tieni premuto il pulsante mentre parli, un po' più vicino al microfono.",
    analysing: "Analizzo la sessione…", expl_changed: "Ora le spiegazioni saranno in {lang}.",
    session_complete: "Sessione completata", how_it_went: "Com'è andata", your_mistakes: "I tuoi errori", new_cards: "Nuove carte",
    remove_hint: "Rimuovi le carte che non vuoi. Le altre sono nella scheda Ripasso.", new_session_btn: "Nuova sessione",
    no_learner_msgs: "In questa sessione non hai detto niente.", no_mistakes: "Nessun errore trovato. Ottimo lavoro!",
    no_new_cards: "Nessuna carta nuova: gli errori che avevano già una carta sono tornati nel ripasso.", remove: "Rimuovi",
    all_caught_up: "Tutto ripassato", nothing_due: "Per ora non c'è niente da ripassare. Torna più tardi!",
    play_audio: "Ascolta", dont_know: "Non lo so: mostra la risposta",
    rating_help: "Quanto la sapevi? Da questo dipende quando la carta tornerà.",
    again: "Ancora", hard: "Difficile", good: "Bene", easy: "Facile",
    again_t: "Non la sapevo: la rivedrai tra pochi minuti", hard_t: "La sapevo a fatica", good_t: "La sapevo",
    easy_t: "Troppo facile: tornerà più avanti", check: "Verifica",
    leave_title: "Vuoi uscire dalla conversazione?", leave_body: "Quello che hai detto finora non verrà analizzato.", btn_leave: "Esci", btn_cancel: "Annulla",
    kind_cloze: "Completa la frase", kind_vocab: "Vocabolario", kind_reverse: "Traduci",
    ph_cloze: "Scrivi la parola mancante…", ph_vocab: "Cosa significa?", ph_reverse: "Scrivilo in {lang}…",
    fb_correct: "Giusto!", fb_accent: "Quasi: controlla gli accenti.", fb_wrong: "Non proprio. La risposta è:",
    fb_skipped: "La risposta è:", fb_selfcheck: "Confronta con la risposta:", you_wrote: "Hai scritto “{answer}”.",
    you_said: "Avevi detto",
    most_frequent: "Errori più frequenti",
    grouped_hint: "Gli errori simili sono raggruppati, anche se sono stati spiegati con parole diverse. Clicca su un errore per vedere tutte le frasi in cui l'hai fatto.", loading: "Caricamento…",
    search_title: "Cerca cosa hai detto", search_btn: "Cerca",
    search_hint: "Una parola o un argomento, es. calcio, la mia amica, il weekend…", searching: "Cerco…",
    said_one: "Hai detto “{q}” {n} volta in {lang}.", said_other: "Hai detto “{q}” {n} volte in {lang}.",
    similar_things: "Cose simili che hai detto:", pct_similar: "simile al {n}%",
    level_title: "{lang} · Livello {level}",
    s_sessions: "Sessioni", s_minutes: "Minuti parlati (stima)", s_accuracy: "Precisione nel ripasso", s_cards: "Carte",
    s_due: "Da ripassare", s_level: "Livello",
    no_lang_mistakes: "Ancora nessun errore in {lang}. Fai prima una conversazione.", fixed: "risolto",
    in_sessions: "{n} sessioni",
  },

  Spanish: {
    nav_talk: "Hablar", nav_review: "Repaso", nav_progress: "Progreso",
    welcome: "Hola", onb_title: "Empecemos a hablar.",
    onb_sub: "Un tutor de voz que recuerda tus errores y los convierte en práctica.",
    your_name: "Tu nombre", want_learn: "Quiero aprender", explanations_in: "Explicaciones en", my_goal: "Mi objetivo",
    goal_ph: "Erasmus, viajes, trabajo...", start: "Empezar",
    new_session: "Nueva sesión", setup_title: "¿Qué quieres practicar?", language: "Idioma", topic: "Tema",
    start_session: "Empezar la sesión", starting: "Empezando…",
    sc_free: "Conversación libre", sc_free_sub: "Habla de lo que quieras",
    sc_rest: "En un restaurante", sc_rest_sub: "Menú, alergias, la cuenta",
    sc_flat: "Alquilar un piso", sc_flat_sub: "Habitaciones, alquiler, caseros",
    sc_weekend: "Tu fin de semana", sc_weekend_sub: "Cuéntale a un amigo qué hiciste",
    sc_dir: "Direcciones", sc_dir_sub: "Calles, estaciones, mapas",
    talk_hint: "Mantén pulsado el botón o la <kbd>barra espaciadora</kbd> para hablar", type_here: "...o escribe aquí",
    send: "Enviar", transcript: "Transcripción", hold_to_talk: "Mantén pulsado para hablar", end_session: "Terminar la sesión",
    close: "Cerrar",
    st_idle: "Mantén pulsado para hablar", st_listening: "Te escucho…", st_thinking: "Pensando…", st_speaking: "Hablando",
    err_prefix: "Error: ", too_short: "Demasiado corto: mantén pulsado mientras hablas.", mic_unavailable: "Micrófono no disponible: ",
    cant_hear: "No he oído nada. Mantén pulsado el botón mientras hablas, un poco más cerca del micrófono.",
    analysing: "Analizando tu sesión…", expl_changed: "Ahora las explicaciones estarán en {lang}.",
    session_complete: "Sesión completada", how_it_went: "Cómo ha ido", your_mistakes: "Tus errores", new_cards: "Tarjetas nuevas",
    remove_hint: "Quita las tarjetas que no quieras. Las demás están en la pestaña Repaso.", new_session_btn: "Nueva sesión",
    no_learner_msgs: "No has dicho nada en esta sesión.", no_mistakes: "No hay errores. ¡Muy bien!",
    no_new_cards: "No hay tarjetas nuevas: los errores que ya tenían tarjeta han vuelto al repaso.", remove: "Quitar",
    all_caught_up: "Todo al día", nothing_due: "Ahora no hay nada que repasar. ¡Vuelve más tarde!",
    play_audio: "Escuchar", dont_know: "No lo sé: ver la respuesta",
    rating_help: "¿Cómo de bien lo sabías? Esto decide cuándo vuelve la tarjeta.",
    again: "Otra vez", hard: "Difícil", good: "Bien", easy: "Fácil",
    again_t: "No lo sabía: vuelve en unos minutos", hard_t: "Lo sabía con dificultad", good_t: "Lo sabía",
    easy_t: "Demasiado fácil: vuelve más tarde", check: "Comprobar",
    leave_title: "¿Salir de la conversación?", leave_body: "Lo que has dicho hasta ahora no se analizará.", btn_leave: "Salir", btn_cancel: "Cancelar",
    kind_cloze: "Completa el hueco", kind_vocab: "Vocabulario", kind_reverse: "Traduce",
    ph_cloze: "Escribe lo que falta…", ph_vocab: "¿Qué significa?", ph_reverse: "Escríbelo en {lang}…",
    fb_correct: "¡Correcto!", fb_accent: "Casi: revisa los acentos.", fb_wrong: "No exactamente. La respuesta es:",
    fb_skipped: "La respuesta es:", fb_selfcheck: "Compara con la respuesta:", you_wrote: "Has escrito «{answer}».",
    you_said: "Dijiste",
    most_frequent: "Errores más frecuentes",
    grouped_hint: "Los errores parecidos se agrupan, aunque se hayan explicado con palabras distintas. Haz clic en uno para ver todas las frases en las que lo cometiste.", loading: "Cargando…",
    search_title: "Busca lo que has dicho", search_btn: "Buscar",
    search_hint: "Una palabra o un tema, p. ej. fútbol, mi amiga, el fin de semana…", searching: "Buscando…",
    said_one: "Has dicho «{q}» {n} vez en {lang}.", said_other: "Has dicho «{q}» {n} veces en {lang}.",
    similar_things: "Cosas parecidas que has dicho:", pct_similar: "{n}% parecido",
    level_title: "{lang} · Nivel {level}",
    s_sessions: "Sesiones", s_minutes: "Minutos hablados (aprox.)", s_accuracy: "Acierto en el repaso", s_cards: "Tarjetas",
    s_due: "Para repasar", s_level: "Nivel",
    no_lang_mistakes: "Aún no hay errores en {lang}. Primero ten una conversación.", fixed: "corregido",
    in_sessions: "{n} sesiones",
  },

  French: {
    nav_talk: "Parler", nav_review: "Révision", nav_progress: "Progrès",
    welcome: "Bonjour", onb_title: "Commençons à parler.",
    onb_sub: "Un tuteur vocal qui retient tes erreurs et les transforme en exercices.",
    your_name: "Ton prénom", want_learn: "Je veux apprendre", explanations_in: "Explications en", my_goal: "Mon objectif",
    goal_ph: "Erasmus, voyage, travail...", start: "Commencer",
    new_session: "Nouvelle session", setup_title: "Que veux-tu pratiquer ?", language: "Langue", topic: "Sujet",
    start_session: "Commencer la session", starting: "Démarrage…",
    sc_free: "Conversation libre", sc_free_sub: "Parle de ce que tu veux",
    sc_rest: "Au restaurant", sc_rest_sub: "Menu, allergies, l'addition",
    sc_flat: "Louer un appartement", sc_flat_sub: "Pièces, loyer, propriétaires",
    sc_weekend: "Ton week-end", sc_weekend_sub: "Raconte à un ami ce que tu as fait",
    sc_dir: "Itinéraire", sc_dir_sub: "Rues, gares, plans",
    talk_hint: "Maintiens le bouton ou la <kbd>barre d'espace</kbd> pour parler", type_here: "...ou écris ici",
    send: "Envoyer", transcript: "Transcription", hold_to_talk: "Maintiens pour parler", end_session: "Terminer la session",
    close: "Fermer",
    st_idle: "Maintiens pour parler", st_listening: "Je t'écoute…", st_thinking: "Je réfléchis…", st_speaking: "Je parle",
    err_prefix: "Erreur : ", too_short: "Trop court : maintiens le bouton pendant que tu parles.", mic_unavailable: "Micro indisponible : ",
    cant_hear: "Je n'ai rien entendu. Maintiens le bouton pendant que tu parles, un peu plus près du micro.",
    analysing: "Analyse de ta session…", expl_changed: "Les explications seront désormais en {lang}.",
    session_complete: "Session terminée", how_it_went: "Bilan", your_mistakes: "Tes erreurs", new_cards: "Nouvelles cartes",
    remove_hint: "Supprime les cartes dont tu ne veux pas. Les autres sont dans l'onglet Révision.", new_session_btn: "Nouvelle session",
    no_learner_msgs: "Tu n'as rien dit pendant cette session.", no_mistakes: "Aucune erreur. Bravo !",
    no_new_cards: "Pas de nouvelles cartes : les erreurs qui avaient déjà une carte sont revenues en révision.", remove: "Supprimer",
    all_caught_up: "Tout est à jour", nothing_due: "Rien à réviser pour l'instant. Reviens plus tard !",
    play_audio: "Écouter", dont_know: "Je ne sais pas : voir la réponse",
    rating_help: "Tu la connaissais bien ? Cela décide quand la carte reviendra.",
    again: "Encore", hard: "Difficile", good: "Bien", easy: "Facile",
    again_t: "Je ne savais pas : elle revient dans quelques minutes", hard_t: "Je savais, avec difficulté", good_t: "Je savais",
    easy_t: "Trop facile : elle reviendra plus tard", check: "Vérifier",
    leave_title: "Quitter la conversation ?", leave_body: "Ce que tu as dit jusqu'ici ne sera pas analysé.", btn_leave: "Quitter", btn_cancel: "Annuler",
    kind_cloze: "Complète la phrase", kind_vocab: "Vocabulaire", kind_reverse: "Traduis",
    ph_cloze: "Écris le ou les mots manquants…", ph_vocab: "Qu'est-ce que ça veut dire ?", ph_reverse: "Écris-le en {lang}…",
    fb_correct: "Correct !", fb_accent: "Presque : vérifie les accents.", fb_wrong: "Pas tout à fait. La réponse est :",
    fb_skipped: "La réponse est :", fb_selfcheck: "Compare avec la réponse :", you_wrote: "Tu as écrit « {answer} ».",
    you_said: "Tu avais dit",
    most_frequent: "Erreurs les plus fréquentes",
    grouped_hint: "Les erreurs semblables sont regroupées, même si elles ont été expliquées avec des mots différents. Clique sur une erreur pour voir toutes les phrases où tu l'as faite.", loading: "Chargement…",
    search_title: "Cherche ce que tu as dit", search_btn: "Chercher",
    search_hint: "Un mot ou un sujet, ex. football, mon amie, le week-end…", searching: "Recherche…",
    said_one: "Tu as dit « {q} » {n} fois en {lang}.", said_other: "Tu as dit « {q} » {n} fois en {lang}.",
    similar_things: "Des phrases semblables que tu as dites :", pct_similar: "similaire à {n} %",
    level_title: "{lang} · Niveau {level}",
    s_sessions: "Sessions", s_minutes: "Minutes parlées (estim.)", s_accuracy: "Réussite en révision", s_cards: "Cartes",
    s_due: "À réviser", s_level: "Niveau",
    no_lang_mistakes: "Pas encore d'erreurs en {lang}. Commence par une conversation.", fixed: "corrigé",
    in_sessions: "{n} sessions",
  },

  German: {
    nav_talk: "Sprechen", nav_review: "Wiederholen", nav_progress: "Fortschritt",
    welcome: "Hallo", onb_title: "Lass uns loslegen.",
    onb_sub: "Ein Sprachtutor, der sich deine Fehler merkt und daraus Übungen macht.",
    your_name: "Dein Name", want_learn: "Ich möchte lernen", explanations_in: "Erklärungen auf", my_goal: "Mein Ziel",
    goal_ph: "Erasmus, Reisen, Arbeit...", start: "Los geht's",
    new_session: "Neue Sitzung", setup_title: "Was möchtest du üben?", language: "Sprache", topic: "Thema",
    start_session: "Sitzung starten", starting: "Startet…",
    sc_free: "Freies Gespräch", sc_free_sub: "Sprich über alles",
    sc_rest: "Im Restaurant", sc_rest_sub: "Speisekarte, Allergien, Rechnung",
    sc_flat: "Wohnung mieten", sc_flat_sub: "Zimmer, Miete, Vermieter",
    sc_weekend: "Dein Wochenende", sc_weekend_sub: "Erzähl einem Freund, was du gemacht hast",
    sc_dir: "Wegbeschreibung", sc_dir_sub: "Straßen, Bahnhöfe, Karten",
    talk_hint: "Halte den Knopf oder die <kbd>Leertaste</kbd> gedrückt, um zu sprechen", type_here: "...oder hier tippen",
    send: "Senden", transcript: "Transkript", hold_to_talk: "Gedrückt halten zum Sprechen", end_session: "Sitzung beenden",
    close: "Schließen",
    st_idle: "Gedrückt halten zum Sprechen", st_listening: "Ich höre zu…", st_thinking: "Ich denke nach…", st_speaking: "Ich spreche",
    err_prefix: "Fehler: ", too_short: "Zu kurz: halte den Knopf gedrückt, während du sprichst.", mic_unavailable: "Mikrofon nicht verfügbar: ",
    cant_hear: "Ich habe nichts gehört. Halte den Knopf gedrückt, während du sprichst, etwas näher am Mikrofon.",
    analysing: "Deine Sitzung wird ausgewertet…", expl_changed: "Erklärungen kommen jetzt auf {lang}.",
    session_complete: "Sitzung beendet", how_it_went: "So lief es", your_mistakes: "Deine Fehler", new_cards: "Neue Karten",
    remove_hint: "Entferne Karten, die du nicht willst. Die anderen findest du unter Wiederholen.", new_session_btn: "Neue Sitzung",
    no_learner_msgs: "Du hast in dieser Sitzung nichts gesagt.", no_mistakes: "Keine Fehler gefunden. Super!",
    no_new_cards: "Keine neuen Karten: Fehler, für die es schon Karten gibt, sind wieder in der Wiederholung.", remove: "Entfernen",
    all_caught_up: "Alles erledigt", nothing_due: "Gerade gibt es nichts zu wiederholen. Schau später wieder vorbei!",
    play_audio: "Anhören", dont_know: "Weiß ich nicht: Antwort zeigen",
    rating_help: "Wie gut wusstest du es? Davon hängt ab, wann die Karte wiederkommt.",
    again: "Nochmal", hard: "Schwer", good: "Gut", easy: "Leicht",
    again_t: "Wusste ich nicht: kommt in ein paar Minuten wieder", hard_t: "Mit Mühe gewusst", good_t: "Gewusst",
    easy_t: "Zu leicht: kommt später wieder", check: "Prüfen",
    leave_title: "Gespräch verlassen?", leave_body: "Was du bisher gesagt hast, wird nicht ausgewertet.", btn_leave: "Verlassen", btn_cancel: "Abbrechen",
    kind_cloze: "Lücke füllen", kind_vocab: "Wortschatz", kind_reverse: "Übersetzen",
    ph_cloze: "Fehlende Wörter eingeben…", ph_vocab: "Was bedeutet das?", ph_reverse: "Schreib es auf {lang}…",
    fb_correct: "Richtig!", fb_accent: "Fast: achte auf die Akzente.", fb_wrong: "Nicht ganz. Die Antwort ist:",
    fb_skipped: "Die Antwort ist:", fb_selfcheck: "Vergleiche mit der Antwort:", you_wrote: "Du hast „{answer}“ geschrieben.",
    you_said: "Du hast gesagt",
    most_frequent: "Häufigste Fehler",
    grouped_hint: "Ähnliche Fehler werden zusammengefasst, auch wenn sie unterschiedlich erklärt wurden. Klicke auf einen Fehler, um alle Sätze zu sehen, in denen er vorkam.", loading: "Wird geladen…",
    search_title: "Suche, was du gesagt hast", search_btn: "Suchen",
    search_hint: "Ein Wort oder ein Thema, z. B. Fußball, meine Freundin, das Wochenende…", searching: "Suche…",
    said_one: "Du hast „{q}“ {n}-mal auf {lang} gesagt.", said_other: "Du hast „{q}“ {n}-mal auf {lang} gesagt.",
    similar_things: "Ähnliches, das du gesagt hast:", pct_similar: "{n} % ähnlich",
    level_title: "{lang} · Niveau {level}",
    s_sessions: "Sitzungen", s_minutes: "Gesprochene Minuten (ca.)", s_accuracy: "Trefferquote", s_cards: "Karten",
    s_due: "Jetzt fällig", s_level: "Niveau",
    no_lang_mistakes: "Noch keine Fehler auf {lang}. Führ zuerst ein Gespräch.", fixed: "behoben",
    in_sessions: "{n} Sitzungen",
  },

  Portuguese: {
    nav_talk: "Falar", nav_review: "Revisão", nav_progress: "Progresso",
    welcome: "Olá", onb_title: "Vamos começar a falar.",
    onb_sub: "Um tutor de voz que se lembra dos seus erros e os transforma em prática.",
    your_name: "Seu nome", want_learn: "Quero aprender", explanations_in: "Explicações em", my_goal: "Meu objetivo",
    goal_ph: "Erasmus, viagens, trabalho...", start: "Começar",
    new_session: "Nova sessão", setup_title: "O que você quer praticar?", language: "Idioma", topic: "Tema",
    start_session: "Começar a sessão", starting: "Começando…",
    sc_free: "Conversa livre", sc_free_sub: "Fale sobre o que quiser",
    sc_rest: "No restaurante", sc_rest_sub: "Cardápio, alergias, a conta",
    sc_flat: "Alugar um apartamento", sc_flat_sub: "Quartos, aluguel, proprietários",
    sc_weekend: "Seu fim de semana", sc_weekend_sub: "Conte a um amigo o que você fez",
    sc_dir: "Direções", sc_dir_sub: "Ruas, estações, mapas",
    talk_hint: "Segure o botão ou a <kbd>barra de espaço</kbd> para falar", type_here: "...ou escreva aqui",
    send: "Enviar", transcript: "Transcrição", hold_to_talk: "Segure para falar", end_session: "Encerrar a sessão",
    close: "Fechar",
    st_idle: "Segure para falar", st_listening: "Estou ouvindo…", st_thinking: "Pensando…", st_speaking: "Falando",
    err_prefix: "Erro: ", too_short: "Curto demais: segure o botão enquanto fala.", mic_unavailable: "Microfone indisponível: ",
    cant_hear: "Não ouvi nada. Segure o botão enquanto fala, um pouco mais perto do microfone.",
    analysing: "Analisando a sua sessão…", expl_changed: "Agora as explicações serão em {lang}.",
    session_complete: "Sessão concluída", how_it_went: "Como foi", your_mistakes: "Seus erros", new_cards: "Cartões novos",
    remove_hint: "Remova os cartões que não quiser. Os outros estão na aba Revisão.", new_session_btn: "Nova sessão",
    no_learner_msgs: "Você não disse nada nesta sessão.", no_mistakes: "Nenhum erro encontrado. Muito bem!",
    no_new_cards: "Nenhum cartão novo: os erros que já tinham cartão voltaram para a revisão.", remove: "Remover",
    all_caught_up: "Tudo em dia", nothing_due: "Nada para revisar agora. Volte mais tarde!",
    play_audio: "Ouvir", dont_know: "Não sei: mostrar a resposta",
    rating_help: "Quão bem você sabia? Isso decide quando o cartão volta.",
    again: "De novo", hard: "Difícil", good: "Bem", easy: "Fácil",
    again_t: "Não sabia: volta em poucos minutos", hard_t: "Sabia com dificuldade", good_t: "Sabia",
    easy_t: "Fácil demais: volta mais tarde", check: "Verificar",
    leave_title: "Sair da conversa?", leave_body: "O que você disse até agora não será analisado.", btn_leave: "Sair", btn_cancel: "Cancelar",
    kind_cloze: "Complete a frase", kind_vocab: "Vocabulário", kind_reverse: "Traduza",
    ph_cloze: "Escreva o que falta…", ph_vocab: "O que significa?", ph_reverse: "Escreva em {lang}…",
    fb_correct: "Certo!", fb_accent: "Quase: confira os acentos.", fb_wrong: "Não exatamente. A resposta é:",
    fb_skipped: "A resposta é:", fb_selfcheck: "Compare com a resposta:", you_wrote: "Você escreveu “{answer}”.",
    you_said: "Você disse",
    most_frequent: "Erros mais frequentes",
    grouped_hint: "Erros parecidos são agrupados, mesmo quando foram explicados com palavras diferentes. Clique em um erro para ver todas as frases em que você o cometeu.", loading: "Carregando…",
    search_title: "Procure o que você disse", search_btn: "Procurar",
    search_hint: "Uma palavra ou um tema, ex. futebol, minha amiga, o fim de semana…", searching: "Procurando…",
    said_one: "Você disse “{q}” {n} vez em {lang}.", said_other: "Você disse “{q}” {n} vezes em {lang}.",
    similar_things: "Coisas parecidas que você disse:", pct_similar: "{n}% parecido",
    level_title: "{lang} · Nível {level}",
    s_sessions: "Sessões", s_minutes: "Minutos falados (estim.)", s_accuracy: "Acerto na revisão", s_cards: "Cartões",
    s_due: "Para revisar", s_level: "Nível",
    no_lang_mistakes: "Ainda não há erros em {lang}. Faça uma conversa primeiro.", fixed: "corrigido",
    in_sessions: "{n} sessões",
  },
};

let ui = "English";
const listeners = [];

export const getUiLanguage = () => ui;
export const getLocale = () => CODES[ui];

export function t(key, vars = {}) {
  const s = STRINGS[ui][key] ?? STRINGS.English[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

// Name of a language in the interface language. inSentence: lowercase where the language requires it.
export function langName(language, { inSentence = false } = {}) {
  const i = LANGS.indexOf(language);
  if (i < 0) return language;
  const name = NAMES[ui][i];
  return inSentence && LOWERCASE_IN_SENTENCE.has(ui) ? name.toLowerCase() : name;
}

// Browser language as a starting point before the learner has chosen one
export function browserLanguage() {
  const code = (navigator.language || "en").slice(0, 2);
  return Object.keys(CODES).find((l) => CODES[l] === code) || "English";
}

export function applyStatic(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  root.querySelectorAll("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  root.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
    el.setAttribute("aria-label", el.title);
  });
  root.querySelectorAll("select[data-lang-options]").forEach((sel) => {
    const value = sel.value;
    sel.innerHTML = LANGS.map((l) => `<option value="${l}">${langName(l)}</option>`).join("");
    if (value) sel.value = value;
  });
}

export function setUiLanguage(language) {
  const next = STRINGS[language] ? language : "English";
  ui = next;
  document.documentElement.lang = CODES[ui];
  applyStatic();
  listeners.forEach((fn) => fn(ui));
}

export function onUiLanguageChange(fn) { listeners.push(fn); }
