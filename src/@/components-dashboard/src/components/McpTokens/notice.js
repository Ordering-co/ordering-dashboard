import { getNoticeLanguage } from '../../utils/legalNotice'

/**
 * All the text of the data notice for MCP keys (Settings → MCP), by language: the legal
 * text (`intro`, `points`, `accept`), its title and message, and the names and
 * descriptions of the scopes, which say what the assistant can do with the key.
 *
 * It lives in code and not in translations on purpose: projects can edit their
 * translations, and the text a user accepts must be fixed and versioned in git.
 *
 * IMPORTANT: the legal text and its version change together, here (`MCP_DATA_NOTICE_VERSION`)
 * and in apiv4 (`McpToken::DATA_NOTICE_VERSION`, returned by `GET mcp/status` as
 * `data_notice_version`), in the same deploy. While one side is deployed without the
 * other the versions differ, and the Dashboard does not let users create a key.
 *
 * Unlike the assistant notice, the data goes to the AI provider the user connects, with
 * their own account and under their terms, not to Ordering's providers.
 * The MCP does not enforce confirmation of changes: apiv4 only tells the model to ask.
 *
 */

/** The version of the text below; the same as `McpToken::DATA_NOTICE_VERSION` in apiv4 */
export const MCP_DATA_NOTICE_VERSION = '2026-10-02'

export const MCP_DATA_NOTICE = {
  en: {
    title: 'Before you connect an AI assistant',
    intro: 'With this key, an AI assistant (such as Claude Code or Codex) can access this Ordering project with your own permissions:',
    points: [
      { label: 'What it can see:', text: 'the data you see in the Dashboard, such as orders, businesses, menus, reports and users, including customers\' personal data (name, phone, email and address).' },
      { label: 'Where that data goes:', text: 'whatever the assistant reads is sent to the AI provider you connect (for example, Anthropic or OpenAI) and is subject to your account\'s terms with that provider, not Ordering\'s. Ordering does not control how that provider stores or uses it.' },
      { label: 'Changes on your behalf:', text: 'if the key can write, the assistant can make changes on your behalf, such as enabling products, changing order statuses or editing offers. Ordering asks the assistant to confirm each change with you, but cannot guarantee it: that depends on the assistant and how you set it up. What it changes with this key is your responsibility.' },
      { label: 'Your responsibility:', text: 'use this key according to your company\'s policies and the data protection laws that apply to you, and do not share it. You can revoke it at any time from this page.' }
    ],
    accept: 'I understand that the data the assistant reads is sent to the AI provider I connect, and I accept using this key under my responsibility. I declare that the company that owns this project has authorized me to do so, and that its privacy policy already tells its customers and users that their personal data can be processed by AI providers for this use.',
    outdated: 'This notice is being updated. Reload the page in a few minutes to create a key.',
    scopes: {
      read: { title: 'Read', description: 'The assistant can search and read the data you see in the Dashboard.' },
      write: { title: 'Read and write', description: 'The assistant can also change menus, categories, products, extras, businesses, order statuses and offers. Ordering asks it to confirm each change with you, but whether it does depends on the assistant and how you set it up.' }
    }
  },
  es: {
    title: 'Antes de conectar un asistente de IA',
    intro: 'Con esta key, un asistente de IA (como Claude Code o Codex) podrá acceder a este proyecto de Ordering con tus mismos permisos:',
    points: [
      { label: 'Qué puede ver:', text: 'los datos que tú ves en el Dashboard, como pedidos, negocios, menús, reportes y usuarios, incluidos los datos personales de los clientes (nombre, teléfono, email y dirección).' },
      { label: 'A dónde van esos datos:', text: 'lo que el asistente lea se envía al proveedor de IA que conectes (por ejemplo, Anthropic u OpenAI) y queda sujeto a las condiciones de tu cuenta con ese proveedor, no a las de Ordering. Ordering no controla cómo ese proveedor guarda o usa esa información.' },
      { label: 'Cambios en tu nombre:', text: 'si la key tiene permiso de escritura, el asistente podrá hacer cambios en tu nombre, como activar productos, cambiar el estado de pedidos o editar ofertas. Ordering le pide al asistente que te confirme cada cambio, pero no puede garantizarlo: depende del asistente y de cómo lo configures. Lo que cambie con esta key es tu responsabilidad.' },
      { label: 'Tu responsabilidad:', text: 'usar esta key conforme a las políticas de tu empresa y a la normativa de protección de datos que te aplique, y no compartirla. Puedes revocarla en cualquier momento desde esta página.' }
    ],
    accept: 'Entiendo que los datos que lea el asistente se envían al proveedor de IA que yo conecte, y acepto usar esta key bajo mi responsabilidad. Declaro que la empresa titular de este proyecto me ha autorizado a hacerlo, y que su política de privacidad ya informa a sus clientes y usuarios de que sus datos personales pueden ser tratados por proveedores de IA para este uso.',
    outdated: 'Este aviso se está actualizando. Recarga la página en unos minutos para crear una key.',
    scopes: {
      read: { title: 'Lectura', description: 'El asistente puede buscar y leer los datos que ves en el Dashboard.' },
      write: { title: 'Lectura y escritura', description: 'El asistente también puede cambiar menús, categorías, productos, extras, negocios, estados de pedidos y ofertas. Ordering le pide que te confirme cada cambio, pero que lo haga depende del asistente y de cómo lo configures.' }
    }
  },
  fr: {
    title: 'Avant de connecter un assistant IA',
    intro: 'Avec cette clé, un assistant IA (comme Claude Code ou Codex) peut accéder à ce projet Ordering avec vos propres autorisations :',
    points: [
      { label: 'Ce qu\'il peut voir :', text: 'les données que vous voyez dans le Dashboard, comme les commandes, commerces, menus, rapports et utilisateurs, y compris les données personnelles des clients (nom, téléphone, e-mail et adresse).' },
      { label: 'Où vont ces données :', text: 'tout ce que l\'assistant lit est envoyé au fournisseur d\'IA que vous connectez (par exemple, Anthropic ou OpenAI) et est soumis aux conditions de votre compte chez ce fournisseur, et non à celles d\'Ordering. Ordering ne contrôle pas la façon dont ce fournisseur stocke ou utilise ces données.' },
      { label: 'Modifications en votre nom :', text: 'si la clé peut écrire, l\'assistant peut effectuer des modifications en votre nom, comme activer des produits, changer le statut des commandes ou modifier des offres. Ordering demande à l\'assistant de vous faire confirmer chaque modification, mais ne peut pas le garantir : cela dépend de l\'assistant et de la façon dont vous le configurez. Ce qu\'il modifie avec cette clé relève de votre responsabilité.' },
      { label: 'Votre responsabilité :', text: 'utiliser cette clé conformément aux politiques de votre entreprise et aux lois sur la protection des données qui s\'appliquent à vous, et ne pas la partager. Vous pouvez la révoquer à tout moment depuis cette page.' }
    ],
    accept: 'Je comprends que les données lues par l\'assistant sont envoyées au fournisseur d\'IA que je connecte, et j\'accepte d\'utiliser cette clé sous ma responsabilité. Je déclare que l\'entreprise titulaire de ce projet m\'y a autorisé et que sa politique de confidentialité informe déjà ses clients et utilisateurs que leurs données personnelles peuvent être traitées par des fournisseurs d\'IA pour cet usage.',
    outdated: 'Cet avis est en cours de mise à jour. Rechargez la page dans quelques minutes pour créer une clé.',
    scopes: {
      read: { title: 'Lecture', description: 'L\'assistant peut rechercher et lire les données que vous voyez dans le Dashboard.' },
      write: { title: 'Lecture et écriture', description: 'L\'assistant peut aussi modifier les menus, catégories, produits, extras, commerces, statuts de commande et offres. Ordering lui demande de vous faire confirmer chaque modification, mais cela dépend de l\'assistant et de la façon dont vous le configurez.' }
    }
  },
  it: {
    title: 'Prima di collegare un assistente IA',
    intro: 'Con questa chiave, un assistente IA (come Claude Code o Codex) può accedere a questo progetto Ordering con i tuoi stessi permessi:',
    points: [
      { label: 'Cosa può vedere:', text: 'i dati che vedi nella Dashboard, come ordini, attività, menu, report e utenti, inclusi i dati personali dei clienti (nome, telefono, email e indirizzo).' },
      { label: 'Dove vanno questi dati:', text: 'tutto ciò che l\'assistente legge viene inviato al fornitore di IA che colleghi (ad esempio Anthropic o OpenAI) ed è soggetto ai termini del tuo account con quel fornitore, non a quelli di Ordering. Ordering non controlla come quel fornitore conserva o usa questi dati.' },
      { label: 'Modifiche per tuo conto:', text: 'se la chiave può scrivere, l\'assistente può apportare modifiche per tuo conto, come attivare prodotti, cambiare lo stato degli ordini o modificare offerte. Ordering chiede all\'assistente di farti confermare ogni modifica, ma non può garantirlo: dipende dall\'assistente e da come lo configuri. Ciò che modifica con questa chiave è tua responsabilità.' },
      { label: 'La tua responsabilità:', text: 'usare questa chiave secondo le politiche della tua azienda e le leggi sulla protezione dei dati che ti si applicano, e non condividerla. Puoi revocarla in qualsiasi momento da questa pagina.' }
    ],
    accept: 'Capisco che i dati letti dall\'assistente vengono inviati al fornitore di IA che collego e accetto di usare questa chiave sotto la mia responsabilità. Dichiaro che l\'azienda titolare di questo progetto mi ha autorizzato a farlo e che la sua informativa sulla privacy informa già i suoi clienti e utenti che i loro dati personali possono essere trattati da fornitori di IA per questo uso.',
    outdated: 'Questo avviso è in fase di aggiornamento. Ricarica la pagina tra qualche minuto per creare una chiave.',
    scopes: {
      read: { title: 'Lettura', description: 'L\'assistente può cercare e leggere i dati che vedi nella Dashboard.' },
      write: { title: 'Lettura e scrittura', description: 'L\'assistente può anche modificare menu, categorie, prodotti, extra, attività, stati degli ordini e offerte. Ordering gli chiede di farti confermare ogni modifica, ma che lo faccia dipende dall\'assistente e da come lo configuri.' }
    }
  },
  de: {
    title: 'Bevor Sie einen KI-Assistenten verbinden',
    intro: 'Mit diesem Schlüssel kann ein KI-Assistent (wie Claude Code oder Codex) mit Ihren eigenen Berechtigungen auf dieses Ordering-Projekt zugreifen:',
    points: [
      { label: 'Was er sehen kann:', text: 'die Daten, die Sie im Dashboard sehen, wie Bestellungen, Geschäfte, Menüs, Berichte und Benutzer, einschließlich personenbezogener Kundendaten (Name, Telefon, E-Mail und Adresse).' },
      { label: 'Wohin diese Daten gehen:', text: 'Alles, was der Assistent liest, wird an den KI-Anbieter gesendet, den Sie verbinden (zum Beispiel Anthropic oder OpenAI), und unterliegt den Bedingungen Ihres Kontos bei diesem Anbieter, nicht denen von Ordering. Ordering hat keinen Einfluss darauf, wie dieser Anbieter die Daten speichert oder nutzt.' },
      { label: 'Änderungen in Ihrem Namen:', text: 'Wenn der Schlüssel schreiben darf, kann der Assistent in Ihrem Namen Änderungen vornehmen, etwa Produkte aktivieren, den Bestellstatus ändern oder Angebote bearbeiten. Ordering weist den Assistenten an, jede Änderung von Ihnen bestätigen zu lassen, kann das aber nicht garantieren: Das hängt vom Assistenten ab und davon, wie Sie ihn einrichten. Was er mit diesem Schlüssel ändert, liegt in Ihrer Verantwortung.' },
      { label: 'Ihre Verantwortung:', text: 'diesen Schlüssel gemäß den Richtlinien Ihres Unternehmens und den für Sie geltenden Datenschutzgesetzen zu nutzen und ihn nicht weiterzugeben. Sie können ihn jederzeit auf dieser Seite widerrufen.' }
    ],
    accept: 'Ich verstehe, dass die Daten, die der Assistent liest, an den von mir verbundenen KI-Anbieter gesendet werden, und ich nutze diesen Schlüssel in eigener Verantwortung. Ich erkläre, dass das Unternehmen, dem dieses Projekt gehört, mich dazu ermächtigt hat und dass seine Datenschutzerklärung seine Kunden und Benutzer bereits darüber informiert, dass ihre personenbezogenen Daten für diesen Zweck von KI-Anbietern verarbeitet werden können.',
    outdated: 'Dieser Hinweis wird gerade aktualisiert. Laden Sie die Seite in einigen Minuten neu, um einen Schlüssel zu erstellen.',
    scopes: {
      read: { title: 'Lesen', description: 'Der Assistent kann die Daten suchen und lesen, die Sie im Dashboard sehen.' },
      write: { title: 'Lesen und Schreiben', description: 'Der Assistent kann außerdem Menüs, Kategorien, Produkte, Extras, Geschäfte, Bestellstatus und Angebote ändern. Ordering weist ihn an, jede Änderung von Ihnen bestätigen zu lassen, aber ob er das tut, hängt vom Assistenten ab und davon, wie Sie ihn einrichten.' }
    }
  },
  pt: {
    title: 'Antes de conectar um assistente de IA',
    intro: 'Com esta chave, um assistente de IA (como o Claude Code ou o Codex) pode acessar este projeto da Ordering com as suas próprias permissões:',
    points: [
      { label: 'O que ele pode ver:', text: 'os dados que você vê no Dashboard, como pedidos, negócios, menus, relatórios e usuários, incluindo os dados pessoais dos clientes (nome, telefone, email e endereço).' },
      { label: 'Para onde vão esses dados:', text: 'tudo o que o assistente lê é enviado ao provedor de IA que você conectar (por exemplo, Anthropic ou OpenAI) e fica sujeito aos termos da sua conta com esse provedor, não aos da Ordering. A Ordering não controla como esse provedor armazena ou usa essas informações.' },
      { label: 'Alterações em seu nome:', text: 'se a chave puder escrever, o assistente poderá fazer alterações em seu nome, como ativar produtos, mudar o status de pedidos ou editar ofertas. A Ordering pede ao assistente que confirme cada alteração com você, mas não pode garantir isso: depende do assistente e de como você o configura. O que ele alterar com esta chave é sua responsabilidade.' },
      { label: 'Sua responsabilidade:', text: 'usar esta chave de acordo com as políticas da sua empresa e as leis de proteção de dados que se aplicam a você, e não compartilhá-la. Você pode revogá-la a qualquer momento nesta página.' }
    ],
    accept: 'Entendo que os dados que o assistente lê são enviados ao provedor de IA que eu conectar e aceito usar esta chave sob minha responsabilidade. Declaro que a empresa titular deste projeto me autorizou a fazer isso e que a política de privacidade dela já informa aos seus clientes e usuários que os dados pessoais deles podem ser tratados por provedores de IA para este uso.',
    outdated: 'Este aviso está sendo atualizado. Recarregue a página em alguns minutos para criar uma chave.',
    scopes: {
      read: { title: 'Leitura', description: 'O assistente pode pesquisar e ler os dados que você vê no Dashboard.' },
      write: { title: 'Leitura e escrita', description: 'O assistente também pode alterar menus, categorias, produtos, extras, negócios, status de pedidos e ofertas. A Ordering pede que ele confirme cada alteração com você, mas isso depende do assistente e de como você o configura.' }
    }
  },
  da: {
    title: 'Før du forbinder en AI-assistent',
    intro: 'Med denne nøgle kan en AI-assistent (som Claude Code eller Codex) få adgang til dette Ordering-projekt med dine egne rettigheder:',
    points: [
      { label: 'Hvad den kan se:', text: 'de data, du ser i Dashboardet, såsom ordrer, forretninger, menuer, rapporter og brugere, inklusive kundernes personoplysninger (navn, telefon, e-mail og adresse).' },
      { label: 'Hvor dataene sendes hen:', text: 'alt, hvad assistenten læser, sendes til den AI-udbyder, du forbinder (fx Anthropic eller OpenAI), og er underlagt vilkårene for din konto hos den udbyder, ikke Orderings. Ordering har ingen kontrol over, hvordan udbyderen opbevarer eller bruger det.' },
      { label: 'Ændringer på dine vegne:', text: 'hvis nøglen kan skrive, kan assistenten foretage ændringer på dine vegne, fx aktivere produkter, ændre ordrestatus eller redigere tilbud. Ordering beder assistenten om at få hver ændring bekræftet af dig, men kan ikke garantere det: det afhænger af assistenten og af, hvordan du sætter den op. Det, den ændrer med denne nøgle, er dit ansvar.' },
      { label: 'Dit ansvar:', text: 'at bruge denne nøgle i overensstemmelse med din virksomheds politikker og den databeskyttelseslovgivning, der gælder for dig, og ikke dele den. Du kan tilbagekalde den når som helst på denne side.' }
    ],
    accept: 'Jeg forstår, at de data, assistenten læser, sendes til den AI-udbyder, jeg forbinder, og jeg accepterer at bruge denne nøgle på eget ansvar. Jeg erklærer, at den virksomhed, der ejer dette projekt, har givet mig tilladelse til det, og at dens privatlivspolitik allerede oplyser dens kunder og brugere om, at deres personoplysninger kan behandles af AI-udbydere til dette formål.',
    outdated: 'Denne meddelelse er ved at blive opdateret. Genindlæs siden om et par minutter for at oprette en nøgle.',
    scopes: {
      read: { title: 'Læse', description: 'Assistenten kan søge i og læse de data, du ser i Dashboardet.' },
      write: { title: 'Læse og skrive', description: 'Assistenten kan også ændre menuer, kategorier, produkter, tilvalg, forretninger, ordrestatus og tilbud. Ordering beder den om at få hver ændring bekræftet af dig, men om den gør det, afhænger af assistenten og af, hvordan du sætter den op.' }
    }
  },
  nl: {
    title: 'Voordat je een AI-assistent koppelt',
    intro: 'Met deze sleutel kan een AI-assistent (zoals Claude Code of Codex) dit Ordering-project openen met jouw eigen rechten:',
    points: [
      { label: 'Wat hij kan zien:', text: 'de gegevens die je in het Dashboard ziet, zoals bestellingen, bedrijven, menu\'s, rapporten en gebruikers, inclusief persoonsgegevens van klanten (naam, telefoon, e-mail en adres).' },
      { label: 'Waar die gegevens heen gaan:', text: 'alles wat de assistent leest, wordt verzonden naar de AI-aanbieder die je koppelt (bijvoorbeeld Anthropic of OpenAI) en valt onder de voorwaarden van jouw account bij die aanbieder, niet die van Ordering. Ordering heeft geen invloed op hoe die aanbieder het opslaat of gebruikt.' },
      { label: 'Wijzigingen namens jou:', text: 'als de sleutel mag schrijven, kan de assistent namens jou wijzigingen doen, zoals producten activeren, bestelstatussen wijzigen of aanbiedingen bewerken. Ordering vraagt de assistent om elke wijziging eerst met jou te bevestigen, maar kan dat niet garanderen: dat hangt af van de assistent en van hoe je hem instelt. Wat hij met deze sleutel wijzigt, is jouw verantwoordelijkheid.' },
      { label: 'Jouw verantwoordelijkheid:', text: 'deze sleutel gebruiken volgens het beleid van je bedrijf en de privacywetgeving die op jou van toepassing is, en hem niet delen. Je kunt hem op elk moment op deze pagina intrekken.' }
    ],
    accept: 'Ik begrijp dat de gegevens die de assistent leest, worden verzonden naar de AI-aanbieder die ik koppel, en ik accepteer deze sleutel op eigen verantwoordelijkheid te gebruiken. Ik verklaar dat het bedrijf dat eigenaar is van dit project mij daartoe heeft gemachtigd, en dat het privacybeleid van het bedrijf zijn klanten en gebruikers al informeert dat hun persoonsgegevens voor dit doel door AI-aanbieders kunnen worden verwerkt.',
    outdated: 'Deze kennisgeving wordt bijgewerkt. Laad de pagina over een paar minuten opnieuw om een sleutel aan te maken.',
    scopes: {
      read: { title: 'Lezen', description: 'De assistent kan de gegevens zoeken en lezen die je in het Dashboard ziet.' },
      write: { title: 'Lezen en schrijven', description: 'De assistent kan ook menu\'s, categorieën, producten, extra\'s, bedrijven, bestelstatussen en aanbiedingen wijzigen. Ordering vraagt hem elke wijziging eerst met jou te bevestigen, maar of hij dat doet, hangt af van de assistent en van hoe je hem instelt.' }
    }
  },
  ar: {
    title: 'قبل ربط مساعد ذكاء اصطناعي',
    intro: 'باستخدام هذا المفتاح، يمكن لمساعد ذكاء اصطناعي (مثل Claude Code أو Codex) الوصول إلى مشروع Ordering هذا بصلاحياتك نفسها:',
    points: [
      { label: 'ما يمكنه رؤيته:', text: 'البيانات التي تراها في لوحة التحكم، مثل الطلبات والأنشطة التجارية والقوائم والتقارير والمستخدمين، بما في ذلك البيانات الشخصية للعملاء (الاسم والهاتف والبريد الإلكتروني والعنوان).' },
      { label: 'إلى أين تذهب هذه البيانات:', text: 'كل ما يقرؤه المساعد يُرسل إلى مزوّد الذكاء الاصطناعي الذي تربطه (مثل Anthropic أو OpenAI) ويخضع لشروط حسابك لدى ذلك المزوّد، وليس لشروط Ordering. لا تتحكم Ordering في كيفية تخزين ذلك المزوّد لهذه البيانات أو استخدامها.' },
      { label: 'تغييرات نيابةً عنك:', text: 'إذا كان للمفتاح صلاحية الكتابة، يمكن للمساعد إجراء تغييرات نيابةً عنك، مثل تفعيل المنتجات أو تغيير حالة الطلبات أو تعديل العروض. تطلب Ordering من المساعد أن يؤكد معك كل تغيير، لكنها لا تستطيع ضمان ذلك: فهذا يعتمد على المساعد وعلى طريقة إعدادك له. ما يغيّره بهذا المفتاح هو مسؤوليتك.' },
      { label: 'مسؤوليتك:', text: 'استخدام هذا المفتاح وفقًا لسياسات شركتك وقوانين حماية البيانات المطبقة عليك، وعدم مشاركته. يمكنك إلغاؤه في أي وقت من هذه الصفحة.' }
    ],
    accept: 'أفهم أن البيانات التي يقرؤها المساعد تُرسل إلى مزوّد الذكاء الاصطناعي الذي أربطه، وأوافق على استخدام هذا المفتاح على مسؤوليتي. وأُقرّ بأن الشركة المالكة لهذا المشروع قد خوّلتني ذلك، وبأن سياسة الخصوصية الخاصة بها تُبلغ عملاءها ومستخدميها بالفعل بأن بياناتهم الشخصية قد تُعالَج من قِبل مزوّدي الذكاء الاصطناعي لهذا الغرض.',
    outdated: 'يجري تحديث هذا الإشعار. أعد تحميل الصفحة بعد بضع دقائق لإنشاء مفتاح.',
    scopes: {
      read: { title: 'قراءة', description: 'يمكن للمساعد البحث في البيانات التي تراها في لوحة التحكم وقراءتها.' },
      write: { title: 'قراءة وكتابة', description: 'يمكن للمساعد أيضًا تغيير القوائم والفئات والمنتجات والإضافات والأنشطة التجارية وحالات الطلبات والعروض. تطلب منه Ordering أن يؤكد معك كل تغيير، لكن ذلك يعتمد على المساعد وعلى طريقة إعدادك له.' }
    }
  },
  el: {
    title: 'Πριν συνδέσετε έναν βοηθό AI',
    intro: 'Με αυτό το κλειδί, ένας βοηθός AI (όπως το Claude Code ή το Codex) μπορεί να έχει πρόσβαση σε αυτό το έργο Ordering με τα δικά σας δικαιώματα:',
    points: [
      { label: 'Τι μπορεί να δει:', text: 'τα δεδομένα που βλέπετε στο Dashboard, όπως παραγγελίες, επιχειρήσεις, μενού, αναφορές και χρήστες, συμπεριλαμβανομένων των προσωπικών δεδομένων των πελατών (όνομα, τηλέφωνο, email και διεύθυνση).' },
      { label: 'Πού πηγαίνουν αυτά τα δεδομένα:', text: 'ό,τι διαβάζει ο βοηθός αποστέλλεται στον πάροχο AI που συνδέετε (για παράδειγμα, Anthropic ή OpenAI) και υπόκειται στους όρους του λογαριασμού σας σε αυτόν τον πάροχο, όχι σε αυτούς της Ordering. Η Ordering δεν ελέγχει πώς αυτός ο πάροχος αποθηκεύει ή χρησιμοποιεί αυτά τα δεδομένα.' },
      { label: 'Αλλαγές για λογαριασμό σας:', text: 'αν το κλειδί έχει δικαίωμα εγγραφής, ο βοηθός μπορεί να κάνει αλλαγές για λογαριασμό σας, όπως ενεργοποίηση προϊόντων, αλλαγή κατάστασης παραγγελιών ή επεξεργασία προσφορών. Η Ordering ζητά από τον βοηθό να επιβεβαιώνει μαζί σας κάθε αλλαγή, αλλά δεν μπορεί να το εγγυηθεί: εξαρτάται από τον βοηθό και από τον τρόπο που τον ρυθμίζετε. Ό,τι αλλάζει με αυτό το κλειδί είναι δική σας ευθύνη.' },
      { label: 'Η ευθύνη σας:', text: 'να χρησιμοποιείτε αυτό το κλειδί σύμφωνα με τις πολιτικές της εταιρείας σας και τη νομοθεσία προστασίας δεδομένων που ισχύει για εσάς, και να μην το μοιράζεστε. Μπορείτε να το ανακαλέσετε οποιαδήποτε στιγμή από αυτή τη σελίδα.' }
    ],
    accept: 'Κατανοώ ότι τα δεδομένα που διαβάζει ο βοηθός αποστέλλονται στον πάροχο AI που συνδέω, και αποδέχομαι να χρησιμοποιώ αυτό το κλειδί με δική μου ευθύνη. Δηλώνω ότι η εταιρεία στην οποία ανήκει αυτό το έργο με έχει εξουσιοδοτήσει να το κάνω και ότι η πολιτική απορρήτου της ήδη ενημερώνει τους πελάτες και τους χρήστες της ότι τα προσωπικά τους δεδομένα μπορεί να υποβάλλονται σε επεξεργασία από παρόχους AI για αυτή τη χρήση.',
    outdated: 'Αυτή η ειδοποίηση ενημερώνεται. Φορτώστε ξανά τη σελίδα σε λίγα λεπτά για να δημιουργήσετε κλειδί.',
    scopes: {
      read: { title: 'Ανάγνωση', description: 'Ο βοηθός μπορεί να αναζητά και να διαβάζει τα δεδομένα που βλέπετε στο Dashboard.' },
      write: { title: 'Ανάγνωση και εγγραφή', description: 'Ο βοηθός μπορεί επίσης να αλλάζει μενού, κατηγορίες, προϊόντα, extras, επιχειρήσεις, καταστάσεις παραγγελιών και προσφορές. Η Ordering του ζητά να επιβεβαιώνει μαζί σας κάθε αλλαγή, αλλά αυτό εξαρτάται από τον βοηθό και από τον τρόπο που τον ρυθμίζετε.' }
    }
  },
  bg: {
    title: 'Преди да свържете AI асистент',
    intro: 'С този ключ AI асистент (като Claude Code или Codex) може да има достъп до този проект в Ordering с вашите собствени права:',
    points: [
      { label: 'Какво може да вижда:', text: 'данните, които виждате в таблото, като поръчки, бизнеси, менюта, отчети и потребители, включително личните данни на клиентите (име, телефон, имейл и адрес).' },
      { label: 'Къде отиват тези данни:', text: 'всичко, което асистентът прочете, се изпраща до доставчика на AI, който свържете (например Anthropic или OpenAI), и е предмет на условията на вашия акаунт при този доставчик, а не на тези на Ordering. Ordering не контролира как този доставчик съхранява или използва тези данни.' },
      { label: 'Промени от ваше име:', text: 'ако ключът има право на запис, асистентът може да прави промени от ваше име, като активиране на продукти, промяна на статуса на поръчки или редактиране на оферти. Ordering изисква от асистента да потвърждава всяка промяна с вас, но не може да гарантира това: зависи от асистента и от начина, по който го настроите. Това, което той променя с този ключ, е ваша отговорност.' },
      { label: 'Вашата отговорност:', text: 'да използвате този ключ в съответствие с политиките на вашата компания и приложимото към вас законодателство за защита на данните и да не го споделяте. Можете да го отмените по всяко време от тази страница.' }
    ],
    accept: 'Разбирам, че данните, които асистентът чете, се изпращат до доставчика на AI, който свържа, и приемам да използвам този ключ на моя отговорност. Декларирам, че компанията, която притежава този проект, ме е упълномощила да го направя и че нейната политика за поверителност вече информира клиентите и потребителите ѝ, че личните им данни могат да бъдат обработвани от доставчици на AI за тази цел.',
    outdated: 'Това известие се актуализира. Презаредете страницата след няколко минути, за да създадете ключ.',
    scopes: {
      read: { title: 'Четене', description: 'Асистентът може да търси и чете данните, които виждате в таблото.' },
      write: { title: 'Четене и запис', description: 'Асистентът може също да променя менюта, категории, продукти, екстри, бизнеси, статуси на поръчки и оферти. Ordering изисква от него да потвърждава всяка промяна с вас, но дали ще го направи, зависи от асистента и от начина, по който го настроите.' }
    }
  },
  tr: {
    title: 'Bir yapay zeka asistanı bağlamadan önce',
    intro: 'Bu anahtarla bir yapay zeka asistanı (Claude Code veya Codex gibi) bu Ordering projesine sizin izinlerinizle erişebilir:',
    points: [
      { label: 'Neleri görebilir:', text: 'Dashboard\'da gördüğünüz veriler; siparişler, işletmeler, menüler, raporlar ve kullanıcılar gibi, müşterilerin kişisel verileri (ad, telefon, e-posta ve adres) dahil.' },
      { label: 'Bu veriler nereye gider:', text: 'asistanın okuduğu her şey bağladığınız yapay zeka sağlayıcısına (örneğin Anthropic veya OpenAI) gönderilir ve Ordering\'in değil, o sağlayıcıdaki hesabınızın koşullarına tabidir. Ordering, bu sağlayıcının verileri nasıl sakladığını veya kullandığını kontrol etmez.' },
      { label: 'Sizin adınıza değişiklikler:', text: 'anahtarın yazma izni varsa asistan sizin adınıza ürünleri etkinleştirmek, sipariş durumlarını değiştirmek veya teklifleri düzenlemek gibi değişiklikler yapabilir. Ordering, asistandan her değişikliği sizinle onaylamasını ister, ancak bunu garanti edemez: bu, asistana ve onu nasıl ayarladığınıza bağlıdır. Asistanın bu anahtarla yaptığı değişiklikler sizin sorumluluğunuzdadır.' },
      { label: 'Sorumluluğunuz:', text: 'bu anahtarı şirketinizin politikalarına ve size uygulanan veri koruma mevzuatına uygun şekilde kullanmak ve paylaşmamak. Bu sayfadan istediğiniz zaman iptal edebilirsiniz.' }
    ],
    accept: 'Asistanın okuduğu verilerin bağladığım yapay zeka sağlayıcısına gönderildiğini anlıyorum ve bu anahtarı kendi sorumluluğumda kullanmayı kabul ediyorum. Bu projenin sahibi olan şirketin beni buna yetkilendirdiğini ve şirketin gizlilik politikasının müşterilerini ve kullanıcılarını kişisel verilerinin bu kullanım için yapay zeka sağlayıcıları tarafından işlenebileceği konusunda zaten bilgilendirdiğini beyan ederim.',
    outdated: 'Bu bildirim güncelleniyor. Anahtar oluşturmak için birkaç dakika sonra sayfayı yeniden yükleyin.',
    scopes: {
      read: { title: 'Okuma', description: 'Asistan, Dashboard\'da gördüğünüz verileri arayabilir ve okuyabilir.' },
      write: { title: 'Okuma ve yazma', description: 'Asistan ayrıca menüleri, kategorileri, ürünleri, ekstraları, işletmeleri, sipariş durumlarını ve teklifleri değiştirebilir. Ordering, ondan her değişikliği sizinle onaylamasını ister, ancak bunu yapıp yapmayacağı asistana ve onu nasıl ayarladığınıza bağlıdır.' }
    }
  }
}

/**
 * The language of the notice text for a Dashboard language code, `en` when there is no
 * text for it. It is the language recorded with the key
 * @param {String} code
 */
export const getMcpDataNoticeLanguage = (code) => getNoticeLanguage(MCP_DATA_NOTICE, code)

/**
 * The notice for a Dashboard language code, in English when there is no text for it
 * @param {String} code
 */
export const getMcpDataNotice = (code) => MCP_DATA_NOTICE[getMcpDataNoticeLanguage(code)]
