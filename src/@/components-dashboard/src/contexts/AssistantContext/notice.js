import { getNoticeLanguage } from '../../utils/legalNotice'

/**
 * All the text of the assistant data notice, by language: the legal text (`points`,
 * `paragraphs`) and the title, button and messages around it.
 *
 * It lives in code and not in translations on purpose: projects can edit their
 * translations, and the text a user accepts must be fixed and versioned in git.
 *
 * IMPORTANT: the legal text and its version change together, here (`ASSISTANT_NOTICE_VERSION`)
 * and in apiv4 (`McpToken::ASSISTANT_DATA_NOTICE_VERSION`, returned by `GET mcp/status`
 * as `assistant_data_notice_version`), in the same deploy. Users then accept the new
 * text. While one side is deployed without the other the versions differ, and the
 * Dashboard does not offer to accept.
 *
 * What the text states, and what has to stay true for it:
 * - Providers: not named, so adding or changing one needs no new version. Any of them
 *   must not train on the data (api-ai `ASSISTANT_LLM_PROVIDER`, `ASSISTANT_MODEL`; on
 *   OpenRouter, `ASSISTANT_OPENROUTER_DATA_COLLECTION=deny`)
 * - 90 days: `ASSISTANT_RETENTION_DAYS` of `ordering:assistant-prune` in apiv4
 * - Confirmation: the api-ai gate (`AssistantGate`) runs no change without it
 *
 */
/** The version of the text below; the same as `McpToken::ASSISTANT_DATA_NOTICE_VERSION` in apiv4 */
export const ASSISTANT_NOTICE_VERSION = 'assistant-2026-10-02'

export const ASSISTANT_NOTICE = {
  en: {
    title: 'Before you start',
    points: [
      'It looks up the project data you have access to, such as orders, sales, stores, catalog, customers and users, and it can propose changes.',
      'It uses your permissions: it can\'t see or change anything you can\'t.',
      'Before changing anything, it shows you each change and makes it only if you confirm.'
    ],
    paragraphs: [
      'To answer, Ordering sends your messages, the page you have open and the project data the assistant reads to its AI providers. Ordering may add or change providers without prior notice when needed for the assistant to work properly, including providers that keep the data for a time under their own policies. None of them uses this data to train their models.',
      'If you ask about your customers, users or drivers, what is sent can include their personal data, such as names, phone numbers, emails or addresses.',
      'Ordering keeps your conversations, including the data the assistant read, for 90 days after the last message, and then deletes them. Ordering keeps a record of the version of this notice you accept.',
      'By accepting, you represent that the company that owns this project has authorized you to accept this notice on its behalf, and that its privacy policy already tells its customers and users that their personal data can be processed by AI providers for this use.'
    ],
    version: 'Notice version _version_',
    accept: 'Accept and start',
    error: 'We couldn\'t save your answer. Try again.',
    outdated: 'This notice is being updated. Reload the page in a few minutes to accept it.'
  },
  es: {
    title: 'Antes de empezar',
    points: [
      'Consulta los datos del proyecto a los que tienes acceso, como pedidos, ventas, tiendas, catálogo, clientes y usuarios, y puede proponer cambios.',
      'Usa tus permisos: no puede ver ni cambiar nada que tú no puedas.',
      'Antes de cambiar algo, te muestra cada cambio y solo lo hace si lo confirmas.'
    ],
    paragraphs: [
      'Para responder, Ordering envía tus mensajes, la página que tienes abierta y los datos del proyecto que lee el asistente a sus proveedores de IA. Ordering puede añadir o cambiar proveedores sin aviso previo cuando haga falta para que el asistente funcione correctamente, incluidos proveedores que conserven los datos durante un tiempo según sus propias políticas. Ninguno de ellos usa estos datos para entrenar sus modelos.',
      'Si preguntas por tus clientes, usuarios o conductores, lo que se envía puede incluir sus datos personales, como nombres, teléfonos, correos o direcciones.',
      'Ordering conserva tus conversaciones, incluidos los datos que leyó el asistente, durante 90 días después del último mensaje, y luego las borra. Ordering guarda un registro de la versión de este aviso que aceptas.',
      'Al aceptar, declaras que la empresa titular de este proyecto te ha autorizado a aceptar este aviso en su nombre, y que su política de privacidad ya informa a sus clientes y usuarios de que sus datos personales pueden ser tratados por proveedores de IA para este uso.'
    ],
    version: 'Versión del aviso _version_',
    accept: 'Aceptar y empezar',
    error: 'No pudimos guardar tu respuesta. Inténtalo de nuevo.',
    outdated: 'Este aviso se está actualizando. Recarga la página en unos minutos para aceptarlo.'
  },
  fr: {
    title: 'Avant de commencer',
    points: [
      'Il consulte les données du projet auxquelles vous avez accès, comme les commandes, les ventes, les magasins, le catalogue, les clients et les utilisateurs, et il peut proposer des modifications.',
      'Il utilise vos autorisations : il ne peut rien voir ni modifier que vous ne puissiez pas.',
      'Avant de modifier quoi que ce soit, il vous montre chaque modification et ne l\'effectue que si vous la confirmez.'
    ],
    paragraphs: [
      'Pour répondre, Ordering envoie vos messages, la page que vous avez ouverte et les données du projet lues par l\'assistant à ses fournisseurs d\'IA. Ordering peut ajouter ou changer de fournisseurs sans préavis lorsque cela est nécessaire au bon fonctionnement de l\'assistant, y compris des fournisseurs qui conservent les données pendant un certain temps selon leurs propres politiques. Aucun d\'eux n\'utilise ces données pour entraîner ses modèles.',
      'Si vous posez des questions sur vos clients, utilisateurs ou livreurs, ce qui est envoyé peut inclure leurs données personnelles, comme des noms, des numéros de téléphone, des e-mails ou des adresses.',
      'Ordering conserve vos conversations, y compris les données lues par l\'assistant, pendant 90 jours après le dernier message, puis les supprime. Ordering conserve une trace de la version de cet avis que vous acceptez.',
      'En acceptant, vous déclarez que l\'entreprise titulaire de ce projet vous a autorisé à accepter cet avis en son nom et que sa politique de confidentialité informe déjà ses clients et utilisateurs que leurs données personnelles peuvent être traitées par des fournisseurs d\'IA pour cet usage.'
    ],
    version: 'Version de l\'avis _version_',
    accept: 'Accepter et commencer',
    error: 'Nous n\'avons pas pu enregistrer votre réponse. Réessayez.',
    outdated: 'Cet avis est en cours de mise à jour. Rechargez la page dans quelques minutes pour l\'accepter.'
  },
  it: {
    title: 'Prima di iniziare',
    points: [
      'Consulta i dati del progetto a cui hai accesso, come ordini, vendite, negozi, catalogo, clienti e utenti, e può proporre modifiche.',
      'Usa i tuoi permessi: non può vedere né modificare nulla che tu non possa.',
      'Prima di modificare qualsiasi cosa, ti mostra ogni modifica e la applica solo se la confermi.'
    ],
    paragraphs: [
      'Per rispondere, Ordering invia i tuoi messaggi, la pagina che hai aperta e i dati del progetto letti dall\'assistente ai propri fornitori di IA. Ordering può aggiungere o cambiare fornitori senza preavviso quando è necessario per il corretto funzionamento dell\'assistente, inclusi fornitori che conservano i dati per un certo periodo secondo le proprie politiche. Nessuno di loro usa questi dati per addestrare i propri modelli.',
      'Se fai domande sui tuoi clienti, utenti o driver, ciò che viene inviato può includere i loro dati personali, come nomi, numeri di telefono, email o indirizzi.',
      'Ordering conserva le tue conversazioni, compresi i dati letti dall\'assistente, per 90 giorni dopo l\'ultimo messaggio, e poi le elimina. Ordering conserva una registrazione della versione di questo avviso che accetti.',
      'Accettando, dichiari che l\'azienda titolare di questo progetto ti ha autorizzato ad accettare questo avviso per suo conto e che la sua informativa sulla privacy informa già i suoi clienti e utenti che i loro dati personali possono essere trattati da fornitori di IA per questo uso.'
    ],
    version: 'Versione dell\'informativa _version_',
    accept: 'Accetta e inizia',
    error: 'Non siamo riusciti a salvare la tua risposta. Riprova.',
    outdated: 'Questo avviso è in fase di aggiornamento. Ricarica la pagina tra qualche minuto per accettarlo.'
  },
  de: {
    title: 'Bevor Sie starten',
    points: [
      'Er ruft die Projektdaten ab, auf die Sie Zugriff haben, etwa Bestellungen, Verkäufe, Geschäfte, Katalog, Kunden und Benutzer, und kann Änderungen vorschlagen.',
      'Er nutzt Ihre Berechtigungen: Er kann nichts sehen oder ändern, was Sie nicht können.',
      'Bevor er etwas ändert, zeigt er Ihnen jede Änderung und führt sie nur aus, wenn Sie sie bestätigen.'
    ],
    paragraphs: [
      'Um zu antworten, sendet Ordering Ihre Nachrichten, die geöffnete Seite und die Projektdaten, die der Assistent liest, an seine KI-Anbieter. Ordering kann ohne vorherige Ankündigung Anbieter hinzufügen oder wechseln, wenn dies für das ordnungsgemäße Funktionieren des Assistenten erforderlich ist, einschließlich Anbietern, die die Daten nach ihren eigenen Richtlinien eine Zeit lang speichern. Keiner von ihnen verwendet diese Daten, um seine Modelle zu trainieren.',
      'Wenn Sie nach Ihren Kunden, Benutzern oder Fahrern fragen, kann das Gesendete deren personenbezogene Daten enthalten, etwa Namen, Telefonnummern, E-Mail-Adressen oder Anschriften.',
      'Ordering speichert Ihre Unterhaltungen, einschließlich der vom Assistenten gelesenen Daten, 90 Tage nach der letzten Nachricht und löscht sie dann. Ordering speichert einen Nachweis darüber, welche Version dieses Hinweises Sie akzeptieren.',
      'Mit Ihrer Zustimmung erklären Sie, dass das Unternehmen, dem dieses Projekt gehört, Sie ermächtigt hat, diesen Hinweis in seinem Namen zu akzeptieren, und dass seine Datenschutzerklärung seine Kunden und Benutzer bereits darüber informiert, dass ihre personenbezogenen Daten für diesen Zweck von KI-Anbietern verarbeitet werden können.'
    ],
    version: 'Hinweisversion _version_',
    accept: 'Akzeptieren und starten',
    error: 'Wir konnten Ihre Antwort nicht speichern. Versuchen Sie es erneut.',
    outdated: 'Dieser Hinweis wird gerade aktualisiert. Laden Sie die Seite in einigen Minuten neu, um ihn zu akzeptieren.'
  },
  pt: {
    title: 'Antes de começar',
    points: [
      'Ele consulta os dados do projeto aos quais você tem acesso, como pedidos, vendas, lojas, catálogo, clientes e usuários, e pode propor alterações.',
      'Ele usa suas permissões: não pode ver nem alterar nada que você não possa.',
      'Antes de alterar qualquer coisa, ele mostra cada alteração e só a faz se você confirmar.'
    ],
    paragraphs: [
      'Para responder, o Ordering envia suas mensagens, a página que você tem aberta e os dados do projeto lidos pelo assistente aos seus provedores de IA. O Ordering pode adicionar ou trocar provedores sem aviso prévio quando for necessário para o bom funcionamento do assistente, incluindo provedores que guardam os dados por um tempo de acordo com suas próprias políticas. Nenhum deles usa esses dados para treinar seus modelos.',
      'Se você perguntar sobre seus clientes, usuários ou motoristas, o que é enviado pode incluir os dados pessoais deles, como nomes, telefones, e-mails ou endereços.',
      'O Ordering guarda suas conversas, incluindo os dados lidos pelo assistente, por 90 dias após a última mensagem e depois as exclui. O Ordering mantém um registro da versão deste aviso que você aceita.',
      'Ao aceitar, você declara que a empresa titular deste projeto autorizou você a aceitar este aviso em nome dela e que a política de privacidade dela já informa aos seus clientes e usuários que os dados pessoais deles podem ser tratados por provedores de IA para este uso.'
    ],
    version: 'Versão do aviso _version_',
    accept: 'Aceitar e começar',
    error: 'Não foi possível salvar sua resposta. Tente novamente.',
    outdated: 'Este aviso está sendo atualizado. Recarregue a página em alguns minutos para aceitá-lo.'
  },
  da: {
    title: 'Før du starter',
    points: [
      'Den slår de projektdata op, som du har adgang til, såsom ordrer, salg, butikker, katalog, kunder og brugere, og den kan foreslå ændringer.',
      'Den bruger dine tilladelser: den kan ikke se eller ændre noget, som du ikke kan.',
      'Før den ændrer noget, viser den dig hver ændring og udfører den kun, hvis du bekræfter.'
    ],
    paragraphs: [
      'For at svare sender Ordering dine beskeder, den side, du har åben, og de projektdata, som assistenten læser, til sine AI-udbydere. Ordering kan tilføje eller skifte udbydere uden forudgående varsel, når det er nødvendigt for, at assistenten fungerer korrekt, herunder udbydere, der opbevarer dataene i en periode i henhold til deres egne politikker. Ingen af dem bruger disse data til at træne deres modeller.',
      'Hvis du spørger om dine kunder, brugere eller chauffører, kan det, der sendes, indeholde deres personoplysninger, såsom navne, telefonnumre, e-mails eller adresser.',
      'Ordering opbevarer dine samtaler, inklusive de data, som assistenten har læst, i 90 dage efter den sidste besked og sletter dem derefter. Ordering registrerer, hvilken version af denne meddelelse du accepterer.',
      'Ved at acceptere erklærer du, at den virksomhed, der ejer dette projekt, har givet dig tilladelse til at acceptere denne meddelelse på dens vegne, og at dens privatlivspolitik allerede oplyser dens kunder og brugere om, at deres personoplysninger kan behandles af AI-udbydere til dette formål.'
    ],
    version: 'Version _version_ af meddelelsen',
    accept: 'Accepter og start',
    error: 'Vi kunne ikke gemme dit svar. Prøv igen.',
    outdated: 'Denne meddelelse er ved at blive opdateret. Genindlæs siden om et par minutter for at acceptere den.'
  },
  nl: {
    title: 'Voordat u begint',
    points: [
      'Hij raadpleegt de projectgegevens waartoe u toegang hebt, zoals bestellingen, verkopen, winkels, catalogus, klanten en gebruikers, en hij kan wijzigingen voorstellen.',
      'Hij gebruikt uw rechten: hij kan niets zien of wijzigen wat u niet kunt.',
      'Voordat hij iets wijzigt, toont hij u elke wijziging en voert hij die alleen uit als u bevestigt.'
    ],
    paragraphs: [
      'Om te antwoorden stuurt Ordering uw berichten, de pagina die u open hebt en de projectgegevens die de assistent leest naar zijn AI-providers. Ordering kan zonder voorafgaande kennisgeving providers toevoegen of wijzigen wanneer dat nodig is voor de goede werking van de assistent, inclusief providers die de gegevens een tijd bewaren volgens hun eigen beleid. Geen van hen gebruikt deze gegevens om hun modellen te trainen.',
      'Als u vragen stelt over uw klanten, gebruikers of chauffeurs, kan wat wordt verzonden hun persoonsgegevens bevatten, zoals namen, telefoonnummers, e-mailadressen of adressen.',
      'Ordering bewaart uw gesprekken, inclusief de gegevens die de assistent heeft gelezen, tot 90 dagen na het laatste bericht en verwijdert ze daarna. Ordering legt vast welke versie van deze kennisgeving u accepteert.',
      'Door te accepteren verklaart u dat het bedrijf dat eigenaar is van dit project u heeft gemachtigd om deze kennisgeving namens het bedrijf te accepteren, en dat het privacybeleid van het bedrijf zijn klanten en gebruikers al informeert dat hun persoonsgegevens voor dit doel door AI-providers kunnen worden verwerkt.'
    ],
    version: 'Versie _version_ van de melding',
    accept: 'Accepteren en starten',
    error: 'We konden uw antwoord niet opslaan. Probeer het opnieuw.',
    outdated: 'Deze kennisgeving wordt bijgewerkt. Laad de pagina over een paar minuten opnieuw om deze te accepteren.'
  },
  ar: {
    title: 'قبل أن تبدأ',
    points: [
      'يطّلع على بيانات المشروع التي لديك صلاحية الوصول إليها، مثل الطلبات والمبيعات والمتاجر والكتالوج والعملاء والمستخدمين، ويمكنه اقتراح تغييرات.',
      'يستخدم صلاحياتك: لا يمكنه رؤية أو تغيير أي شيء لا يمكنك أنت رؤيته أو تغييره.',
      'قبل تغيير أي شيء، يعرض عليك كل تغيير ولا ينفّذه إلا إذا أكّدته.'
    ],
    paragraphs: [
      'للإجابة، يرسل Ordering رسائلك والصفحة المفتوحة لديك وبيانات المشروع التي يقرأها المساعد إلى مزوّدي الذكاء الاصطناعي الذين يتعامل معهم. ويجوز لـ Ordering إضافة مزوّدين أو تغييرهم دون إشعار مسبق عند الحاجة لضمان عمل المساعد بشكل صحيح، بما في ذلك مزوّدون يحتفظون بالبيانات لفترة من الوقت وفقًا لسياساتهم الخاصة. ولا يستخدم أيٌّ منهم هذه البيانات لتدريب نماذجه.',
      'إذا سألت عن عملائك أو مستخدميك أو سائقيك، فقد يتضمن ما يُرسَل بياناتهم الشخصية، مثل الأسماء أو أرقام الهواتف أو عناوين البريد الإلكتروني أو العناوين.',
      'يحتفظ Ordering بمحادثاتك، بما في ذلك البيانات التي قرأها المساعد، لمدة 90 يومًا بعد آخر رسالة، ثم يحذفها. ويحتفظ Ordering بسجلّ لإصدار هذا الإشعار الذي توافق عليه.',
      'بموافقتك، تُقرّ بأن الشركة المالكة لهذا المشروع قد خوّلتك قبول هذا الإشعار نيابةً عنها، وبأن سياسة الخصوصية الخاصة بها تُبلغ عملاءها ومستخدميها بالفعل بأن بياناتهم الشخصية قد تُعالَج من قِبل مزوّدي الذكاء الاصطناعي لهذا الغرض.'
    ],
    version: 'إصدار الإشعار _version_',
    accept: 'قبول والبدء',
    error: 'تعذّر حفظ إجابتك. حاول مرة أخرى.',
    outdated: 'يجري تحديث هذا الإشعار. أعد تحميل الصفحة بعد بضع دقائق لقبوله.'
  },
  el: {
    title: 'Πριν ξεκινήσετε',
    points: [
      'Αναζητά τα δεδομένα του έργου στα οποία έχετε πρόσβαση, όπως παραγγελίες, πωλήσεις, καταστήματα, κατάλογο, πελάτες και χρήστες, και μπορεί να προτείνει αλλαγές.',
      'Χρησιμοποιεί τα δικαιώματά σας: δεν μπορεί να δει ή να αλλάξει τίποτα που δεν μπορείτε εσείς.',
      'Πριν αλλάξει οτιδήποτε, σας δείχνει κάθε αλλαγή και την εκτελεί μόνο αν την επιβεβαιώσετε.'
    ],
    paragraphs: [
      'Για να απαντήσει, η Ordering στέλνει τα μηνύματά σας, τη σελίδα που έχετε ανοιχτή και τα δεδομένα του έργου που διαβάζει ο βοηθός στους παρόχους τεχνητής νοημοσύνης της. Η Ordering μπορεί να προσθέσει ή να αλλάξει παρόχους χωρίς προηγούμενη ειδοποίηση, όταν αυτό απαιτείται για τη σωστή λειτουργία του βοηθού, συμπεριλαμβανομένων παρόχων που διατηρούν τα δεδομένα για ένα διάστημα σύμφωνα με τις δικές τους πολιτικές. Κανένας από αυτούς δεν χρησιμοποιεί αυτά τα δεδομένα για να εκπαιδεύσει τα μοντέλα του.',
      'Αν ρωτήσετε για τους πελάτες, τους χρήστες ή τους οδηγούς σας, όσα αποστέλλονται μπορεί να περιλαμβάνουν προσωπικά τους δεδομένα, όπως ονόματα, αριθμούς τηλεφώνου, email ή διευθύνσεις.',
      'Η Ordering διατηρεί τις συνομιλίες σας, συμπεριλαμβανομένων των δεδομένων που διάβασε ο βοηθός, για 90 ημέρες μετά το τελευταίο μήνυμα και στη συνέχεια τις διαγράφει. Η Ordering τηρεί αρχείο της έκδοσης αυτής της ειδοποίησης που αποδέχεστε.',
      'Με την αποδοχή, δηλώνετε ότι η εταιρεία στην οποία ανήκει αυτό το έργο σάς έχει εξουσιοδοτήσει να αποδεχτείτε αυτή την ειδοποίηση για λογαριασμό της και ότι η πολιτική απορρήτου της ήδη ενημερώνει τους πελάτες και τους χρήστες της ότι τα προσωπικά τους δεδομένα μπορεί να υποβάλλονται σε επεξεργασία από παρόχους τεχνητής νοημοσύνης για αυτή τη χρήση.'
    ],
    version: 'Έκδοση ειδοποίησης _version_',
    accept: 'Αποδοχή και έναρξη',
    error: 'Δεν μπορέσαμε να αποθηκεύσουμε την απάντησή σας. Δοκιμάστε ξανά.',
    outdated: 'Αυτή η ειδοποίηση ενημερώνεται. Φορτώστε ξανά τη σελίδα σε λίγα λεπτά για να την αποδεχτείτε.'
  },
  bg: {
    title: 'Преди да започнете',
    points: [
      'Преглежда данните на проекта, до които имате достъп, като поръчки, продажби, магазини, каталог, клиенти и потребители, и може да предлага промени.',
      'Използва вашите права: не може да вижда или променя нищо, което вие не можете.',
      'Преди да промени нещо, ви показва всяка промяна и я извършва само ако я потвърдите.'
    ],
    paragraphs: [
      'За да отговори, Ordering изпраща вашите съобщения, страницата, която сте отворили, и данните на проекта, които асистентът чете, на своите доставчици на изкуствен интелект. Ordering може да добавя или сменя доставчици без предварително уведомление, когато това е необходимо за правилната работа на асистента, включително доставчици, които съхраняват данните за известно време съгласно собствените си политики. Никой от тях не използва тези данни за обучение на своите модели.',
      'Ако питате за вашите клиенти, потребители или шофьори, изпращаното може да включва техни лични данни, като имена, телефонни номера, имейли или адреси.',
      'Ordering съхранява вашите разговори, включително данните, които асистентът е прочел, в продължение на 90 дни след последното съобщение, след което ги изтрива. Ordering пази запис за версията на това известие, която приемате.',
      'С приемането декларирате, че компанията, която притежава този проект, ви е упълномощила да приемете това известие от нейно име и че нейната политика за поверителност вече информира клиентите и потребителите ѝ, че личните им данни могат да бъдат обработвани от доставчици на изкуствен интелект за тази цел.'
    ],
    version: 'Версия на известието _version_',
    accept: 'Приемете и започнете',
    error: 'Не успяхме да запазим отговора ви. Опитайте отново.',
    outdated: 'Това известие се актуализира. Презаредете страницата след няколко минути, за да го приемете.'
  },
  tr: {
    title: 'Başlamadan önce',
    points: [
      'Erişiminiz olan proje verilerine, örneğin siparişlere, satışlara, mağazalara, kataloğa, müşterilere ve kullanıcılara bakar ve değişiklik önerebilir.',
      'İzinlerinizi kullanır: sizin göremediğiniz veya değiştiremediğiniz hiçbir şeyi göremez ya da değiştiremez.',
      'Herhangi bir şeyi değiştirmeden önce size her değişikliği gösterir ve yalnızca onaylarsanız uygular.'
    ],
    paragraphs: [
      'Yanıt vermek için Ordering, mesajlarınızı, açık olan sayfayı ve asistanın okuduğu proje verilerini yapay zekâ sağlayıcılarına gönderir. Ordering, asistanın düzgün çalışması için gerektiğinde önceden bildirimde bulunmadan sağlayıcı ekleyebilir veya değiştirebilir; buna verileri kendi politikalarına göre bir süre saklayan sağlayıcılar da dahildir. Bu sağlayıcıların hiçbiri bu verileri kendi modellerini eğitmek için kullanmaz.',
      'Müşterileriniz, kullanıcılarınız veya sürücüleriniz hakkında soru sorarsanız, gönderilenler onların adları, telefon numaraları, e-posta adresleri veya adresleri gibi kişisel verilerini içerebilir.',
      'Ordering, asistanın okuduğu veriler dahil olmak üzere konuşmalarınızı son mesajdan sonra 90 gün boyunca saklar ve ardından siler. Ordering, kabul ettiğiniz bu bildirimin sürümünün kaydını tutar.',
      'Kabul ederek, bu projenin sahibi olan şirketin sizi bu bildirimi kendi adına kabul etmeye yetkilendirdiğini ve şirketin gizlilik politikasının müşterilerini ve kullanıcılarını kişisel verilerinin bu kullanım için yapay zekâ sağlayıcıları tarafından işlenebileceği konusunda zaten bilgilendirdiğini beyan edersiniz.'
    ],
    version: 'Bildirim sürümü _version_',
    accept: 'Kabul et ve başla',
    error: 'Yanıtınızı kaydedemedik. Tekrar deneyin.',
    outdated: 'Bu bildirim güncelleniyor. Kabul etmek için birkaç dakika sonra sayfayı yeniden yükleyin.'
  }
}

/**
 * The language of the notice text for a Dashboard language code (`es`, `es-MX` → `es`),
 * `en` when there is no text for it. It is the language recorded with the acceptance
 * @param {String} code
 */
export const getAssistantNoticeLanguage = (code) => getNoticeLanguage(ASSISTANT_NOTICE, code)

/**
 * The notice for a Dashboard language code, in English when there is no text for it
 * @param {String} code
 */
export const getAssistantNotice = (code) => ASSISTANT_NOTICE[getAssistantNoticeLanguage(code)]
