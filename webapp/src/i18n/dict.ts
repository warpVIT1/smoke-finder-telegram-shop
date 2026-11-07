export type Lang = "en" | "uk" | "ru";

export interface Dict {
  miniapp: string;
  ageTitle: string; ageIn: string; ageOut: string; ageSub: string; ageNote: string;
  searchPh: string; all: string; disposables: string; liquids: string; pods: string; accessories: string;
  fType: string; fFlavourOn: string; fVolume: string; fVolumeAll: string; nProducts: string; add: string;
  sortDefault: string; sortPriceAsc: string; sortPriceDesc: string; sortBest: string;
  cartBtn: string;
  best: string; flavourLbl: string; colourLbl: string; ohmLbl: string;
  pDesc1: string; addBtn: string;
  flIcedMango: string; flBlueRazz: string; flWatermelon: string; flPeach: string;
  pSpecLine: string;
  pBody: string;
  puffs: string; nicotine: string; charging: string;
  cartTitle: string; threeItems: string; promoPh: string; apply: string;
  deliveryLbl: string; paymentLbl: string; contactsLbl: string;
  courierT: string; courierS: string;
  pickupT: string; pickupS: string; free: string;
  etT: string; etS: string; cashT: string; cashS: string; wpT: string; wpS: string;
  pointsT: string; pointsS: (cost: number) => string;
  fromTg: string; edit: string;
  subtotal: string; discountLbl: string; shipping: string; tax: string; total: string;
  payBtn: string;
  profile: string; memberSince: string; points: string;
  pointsSub: string; currentOrder: string; orderWord: string;
  referralTitle: string; referralSub: string; referralCopy: string;
  stPlaced: string; stPacked: string; stWay: string; eta: string; etaPickup: string;
  history: string; delivered: string; cancelled: string;
  addresses: string; support: string; about: string;
  repeatBtn: string;
  tDisposable: string; tLiquid: string; tPod: string; tAcc: string;
  inStock: string; low: (count: number) => string; preorder: string;
  hDelivered: string; hCancelled: string; dates: string[];
  // extra, beyond the design mock — needed for a working app
  loading: string; emptyCart: string; noResults: string;
  cartCountLabel: (count: number, total: string) => string;
  addToCartLabel: (price: string) => string;
  placeOrderLabel: (total: string) => string;
  wishlistBtn: string; wishlistMsg: string; wishlistManagerBtn: string;
  orderPlacedTitle: string; orderPlacedBody: string; backToCatalog: string;
  nameLbl: string; phoneLbl: string; addressLbl: string; addressPh: string;
  aboutBody: string; supportUnset: string;
  phoneRequiredHint: string; addressRequiredHint: string; etProofNote: string;
  addAddressBtn: string; noAddresses: string; deleteBtn: string;
  myWishlist: string; myWishlistEmpty: string;
  newBadge: string;
}

export const DICT: Record<Lang, Dict> = {
  en: {
    miniapp: "mini app",
    ageTitle: "18+ only", ageIn: "I am 18 or older", ageOut: "I am under 18 — exit",
    ageSub: "Smoke Finder sells nicotine vaping devices and e-liquids. Confirm your age to continue.",
    ageNote: "Legal age in Alberta: 18+. We may ask for ID on delivery.",
    searchPh: "Search flavour or device", all: "All", disposables: "Disposables", liquids: "E-liquids", pods: "Pods", accessories: "Coils",
    fType: "Sort", fFlavourOn: "Flavour: fruit", fVolume: "Volume", fVolumeAll: "All volumes", nProducts: "24 products", add: "Add",
    sortDefault: "Default", sortPriceAsc: "Price: low to high", sortPriceDesc: "Price: high to low", sortBest: "Best sellers first",
    cartBtn: "Cart",
    best: "BEST SELLER", flavourLbl: "FLAVOUR", colourLbl: "COLOUR", ohmLbl: "OHM",
    pDesc1: "Disposable device · ~7 000 puffs", addBtn: "Add to cart",
    flIcedMango: "Iced Mango", flBlueRazz: "Blue Razz", flWatermelon: "Watermelon Mint", flPeach: "Peach Ice",
    pSpecLine: "USB-C · 650 mAh\n16 mL, mesh coil",
    pBody: "Ripe mango with a cold finish on the exhale. The mesh coil holds the flavour to the last puff, and the battery level sits on the body of the device.",
    puffs: "Puffs", nicotine: "Nicotine", charging: "Charging",
    cartTitle: "Cart", threeItems: "items", promoPh: "Promo code", apply: "Apply",
    deliveryLbl: "DELIVERY", paymentLbl: "PAYMENT", contactsLbl: "CONTACT",
    courierT: "Local courier today", courierS: "6:00–10:00 PM · within Calgary",
    pickupT: "Pickup", pickupS: "417 8 Ave SW · after 2 PM today", free: "Free",
    etT: "Interac e-Transfer", etS: "send to payments@example.com", cashT: "Cash", cashS: "on delivery",
    wpT: "Wallet Pay", wpS: "pay with crypto in Telegram",
    pointsT: "Loyalty points", pointsS: (cost) => `costs ${cost} pt${cost === 1 ? "" : "s"}`,
    fromTg: "from Telegram", edit: "edit",
    subtotal: "Subtotal", discountLbl: "Discount", shipping: "Delivery", tax: "GST 5% (AB)", total: "Total",
    payBtn: "Place order",
    profile: "Account", memberSince: "member since", points: "points",
    pointsSub: "loyalty points = discount on your next order", currentOrder: "CURRENT ORDER", orderWord: "Order",
    referralTitle: "Invite friends", referralSub: "1 point for every 15 new people you invite — tap to copy your link",
    referralCopy: "Copy",
    stPlaced: "Placed", stPacked: "Preparing", stWay: "Ready", eta: "Courier today 4:30–8:30 PM · message us",
    etaPickup: "Ready for pickup · Calgary, Westbrook Station, today 4:30–10 PM · message us",
    history: "ORDER HISTORY", delivered: "Delivered", cancelled: "Cancelled",
    addresses: "Delivery addresses", support: "Support on Telegram", about: "About the store · 18+",
    repeatBtn: "Reorder",
    tDisposable: "Disposable", tLiquid: "E-liquid, 60 mL", tPod: "Pod kit", tAcc: "Accessories",
    inStock: "In stock", low: (count) => `Only ${count} left`, preorder: "Pre-order · 3–5 days",
    hDelivered: "Delivered", hCancelled: "Cancelled", dates: ["Aug 12", "Jul 28", "Jul 14"],
    loading: "Loading…", emptyCart: "Your cart is empty", noResults: "No products found",
    cartCountLabel: (count, total) => `Cart · ${count} — ${total}`,
    addToCartLabel: (price) => `Add to cart — ${price}`,
    placeOrderLabel: (total) => `Place order — ${total}`,
    wishlistBtn: "❤️ Add to wishlist",
    wishlistMsg: "We don't stock this yet — this just tells us you want it. Ready to pay the full price right now? You'll get a lifetime 5% discount. Message the manager to arrange it.",
    wishlistManagerBtn: "Message manager",
    orderPlacedTitle: "Order placed", orderPlacedBody: "We'll message you here with updates.",
    backToCatalog: "Back to catalogue",
    nameLbl: "Name", phoneLbl: "Phone", addressLbl: "Address", addressPh: "Street, unit, city, postal code",
    aboutBody: "Smoke Finder — nicotine vaping devices and e-liquids in Calgary, AB. 18+ only. Courier or pickup, Interac e-Transfer or cash on delivery, GST 5%.",
    supportUnset: "Support contact isn't set up yet — please try again later.",
    phoneRequiredHint: "Enter a valid Canadian phone number (10 digits).",
    etProofNote: "After placing your order we'll message you here with the amount to send. Send the e-Transfer, then reply with a screenshot — we'll confirm once we see it.",
    addressRequiredHint: "Enter a delivery address for courier delivery.",
    addAddressBtn: "Add", noAddresses: "No saved addresses yet", deleteBtn: "Delete",
    myWishlist: "My wishlist", myWishlistEmpty: "You haven't added anything to your wishlist yet",
    newBadge: "NEW",
  },
  uk: {
    miniapp: "мініпрограма",
    ageTitle: "18+ тільки", ageIn: "Мені 18 або більше", ageOut: "Мені менше 18 — вийти",
    ageSub: "Smoke Finder продає пристрої для вейпінгу та рідини з нікотином. Підтвердьте вік, щоб продовжити.",
    ageNote: "Законний вік в Альберті: 18+. Курʼєр може попросити ID.",
    searchPh: "Пошук смаку або пристрою", all: "Усе", disposables: "Одноразові", liquids: "Рідини", pods: "Поди", accessories: "Койли",
    fType: "Сортування", fFlavourOn: "Смак: фрукти", fVolume: "Обʼєм", fVolumeAll: "Усі обʼєми", nProducts: "24 товари", add: "Додати",
    sortDefault: "За замовчуванням", sortPriceAsc: "Ціна: спочатку дешевші", sortPriceDesc: "Ціна: спочатку дорожчі", sortBest: "Спочатку хіти",
    cartBtn: "Кошик",
    best: "ХІТ", flavourLbl: "СМАК", colourLbl: "КОЛІР", ohmLbl: "ОМ",
    pDesc1: "Одноразовий пристрій · ~7 000 тяг", addBtn: "До кошика",
    flIcedMango: "Манго-лід", flBlueRazz: "Блю разз", flWatermelon: "Кавун-мʼята", flPeach: "Персик-лід",
    pSpecLine: "USB-C · 650 mAh\n16 мл, сітчастий випарник",
    pBody: "Спіле манго з холодним фінішем на видиху. Сітчастий випарник тримає смак до останньої тяги, індикатор заряду — на корпусі.",
    puffs: "Тяги", nicotine: "Нікотин", charging: "Заряджання",
    cartTitle: "Кошик", threeItems: "позицій", promoPh: "Промокод", apply: "Застосувати",
    deliveryLbl: "ДОСТАВКА", paymentLbl: "ОПЛАТА", contactsLbl: "КОНТАКТИ",
    courierT: "Курʼєр сьогодні", courierS: "18:00–22:00 · у межах Калгарі",
    pickupT: "Самовивіз", pickupS: "417 8 Ave SW · після 14:00", free: "Безкоштовно",
    etT: "Interac e-Transfer", etS: "переказ на payments@example.com", cashT: "Готівка", cashS: "при отриманні",
    wpT: "Wallet Pay", wpS: "оплата криптою в Telegram",
    pointsT: "Бонусні бали", pointsS: (cost) => `коштує ${cost} бал(ів)`,
    fromTg: "з Telegram", edit: "змінити",
    subtotal: "Товари", discountLbl: "Знижка", shipping: "Доставка", tax: "GST 5% (AB)", total: "Разом",
    payBtn: "Оформити",
    profile: "Профіль", memberSince: "клієнт з", points: "балів",
    pointsSub: "бонусні бали = знижка на наступне замовлення", currentOrder: "ПОТОЧНЕ ЗАМОВЛЕННЯ", orderWord: "Замовлення",
    referralTitle: "Запросіть друзів", referralSub: "1 бал за кожні 15 нових запрошених — натисніть, щоб скопіювати посилання",
    referralCopy: "Копіювати",
    stPlaced: "Оформлено", stPacked: "Готується", stWay: "Готово", eta: "Кур'єр сьогодні 16:30–20:30 · звʼязатися",
    etaPickup: "Готово до самовивозу · Calgary, Westbrook Station, сьогодні 16:30–22:00 · звʼязатися",
    history: "ІСТОРІЯ ЗАМОВЛЕНЬ", delivered: "Доставлено", cancelled: "Скасовано",
    addresses: "Адреси доставки", support: "Підтримка в Telegram", about: "Про магазин · 18+",
    repeatBtn: "Повторити",
    tDisposable: "Одноразовий", tLiquid: "Рідина, 60 мл", tPod: "Под-система", tAcc: "Аксесуари",
    inStock: "В наявності", low: (count) => `Залишилось ${count}`, preorder: "Передзамовлення · 3–5 днів",
    hDelivered: "Доставлено", hCancelled: "Скасовано", dates: ["12 серп", "28 лип", "14 лип"],
    loading: "Завантаження…", emptyCart: "Кошик порожній", noResults: "Товарів не знайдено",
    cartCountLabel: (count, total) => `Кошик · ${count} — ${total}`,
    addToCartLabel: (price) => `До кошика — ${price}`,
    placeOrderLabel: (total) => `Оформити — ${total}`,
    wishlistBtn: "❤️ Додати в бажане",
    wishlistMsg: "Цього поки немає в наявності — так ми бачимо, що це цікаво. Готові оплатити повну вартість зараз? Отримаєте довічну знижку 5%. Напишіть менеджеру, щоб домовитись.",
    wishlistManagerBtn: "Написати менеджеру",
    orderPlacedTitle: "Замовлення оформлено", orderPlacedBody: "Напишемо вам сюди з оновленнями.",
    backToCatalog: "До каталогу",
    nameLbl: "Ім'я", phoneLbl: "Телефон", addressLbl: "Адреса", addressPh: "Вулиця, квартира, місто, індекс",
    aboutBody: "Smoke Finder — пристрої для вейпінгу та рідини з нікотином у Калгарі, AB. Тільки 18+. Кур'єр або самовивіз, Interac e-Transfer або готівка при отриманні, GST 5%.",
    supportUnset: "Контакт підтримки ще не налаштований — спробуйте пізніше.",
    phoneRequiredHint: "Вкажіть коректний номер (10 цифр).",
    addressRequiredHint: "Вкажіть адресу доставки для кур'єра.",
    etProofNote: "Після оформлення замовлення ми напишемо суму до переказу. Надішліть e-Transfer, потім дайте нам скріншот — підтвердимо, щойно побачимо.",
    addAddressBtn: "Додати", noAddresses: "Ще немає збережених адрес", deleteBtn: "Видалити",
    myWishlist: "Моє бажане", myWishlistEmpty: "Ви ще нічого не додали в бажане",
    newBadge: "НОВЕ",
  },
  ru: {
    miniapp: "мини-приложение",
    ageTitle: "Только 18+", ageIn: "Мне 18 или больше", ageOut: "Мне меньше 18 — выйти",
    ageSub: "Smoke Finder продаёт устройства для вейпинга и жидкости с никотином. Подтвердите возраст, чтобы продолжить.",
    ageNote: "Легальный возраст в Альберте: 18+. Курьер может спросить ID.",
    searchPh: "Найти вкус или устройство", all: "Всё", disposables: "Одноразовые", liquids: "Жидкости", pods: "Поды", accessories: "Коилы",
    fType: "Сортировка", fFlavourOn: "Вкус: фрукты", fVolume: "Объём", fVolumeAll: "Все объёмы", nProducts: "24 товара", add: "В корзину",
    sortDefault: "По умолчанию", sortPriceAsc: "Цена: сначала дешевле", sortPriceDesc: "Цена: сначала дороже", sortBest: "Сначала хиты",
    cartBtn: "Корзина",
    best: "ХИТ", flavourLbl: "ВКУС", colourLbl: "ЦВЕТ", ohmLbl: "ОМ",
    pDesc1: "Одноразовое устройство · ~7 000 затяжек", addBtn: "В корзину",
    flIcedMango: "Манго-лёд", flBlueRazz: "Блю разз", flWatermelon: "Арбуз-мята", flPeach: "Персик-лёд",
    pSpecLine: "USB-C · 650 mAh\n16 мл, сетчатый испаритель",
    pBody: "Спелое манго с ледяной ноткой на выдохе. Сетчатый испаритель держит вкус до последней затяжки, индикатор заряда — на корпусе.",
    puffs: "Затяжки", nicotine: "Никотин", charging: "Зарядка",
    cartTitle: "Корзина", threeItems: "позиций", promoPh: "Промокод", apply: "Применить",
    deliveryLbl: "ДОСТАВКА", paymentLbl: "ОПЛАТА", contactsLbl: "КОНТАКТЫ",
    courierT: "Курьер сегодня", courierS: "18:00–22:00 · по Калгари",
    pickupT: "Самовывоз", pickupS: "417 8 Ave SW · после 14:00", free: "Бесплатно",
    etT: "Interac e-Transfer", etS: "перевод на payments@example.com", cashT: "Наличные", cashS: "при получении",
    wpT: "Wallet Pay", wpS: "оплата криптой в Telegram",
    pointsT: "Бонусные баллы", pointsS: (cost) => `стоит ${cost} балл(ов)`,
    fromTg: "из Telegram", edit: "изменить",
    subtotal: "Товары", discountLbl: "Скидка", shipping: "Доставка", tax: "GST 5% (AB)", total: "Итого",
    payBtn: "Оформить заказ",
    profile: "Профиль", memberSince: "клиент с", points: "баллов",
    pointsSub: "бонусные баллы = скидка на следующий заказ", currentOrder: "ТЕКУЩИЙ ЗАКАЗ", orderWord: "Заказ",
    referralTitle: "Пригласите друзей", referralSub: "1 балл за каждые 15 новых приглашённых — нажмите, чтобы скопировать ссылку",
    referralCopy: "Копировать",
    stPlaced: "Оформлен", stPacked: "Готовится", stWay: "Готово", eta: "Курьер сегодня 16:30–20:30 · связаться",
    etaPickup: "Готово к самовывозу · Calgary, Westbrook Station, сегодня 16:30–22:00 · связаться",
    history: "ИСТОРИЯ ЗАКАЗОВ", delivered: "Доставлен", cancelled: "Отменён",
    addresses: "Адреса доставки", support: "Поддержка в Telegram", about: "О магазине · 18+",
    repeatBtn: "Повторить",
    tDisposable: "Одноразовый", tLiquid: "Жидкость, 60 мл", tPod: "Под-система", tAcc: "Аксессуары",
    inStock: "В наличии", low: (count) => `Осталось ${count}`, preorder: "Предзаказ · 3–5 дней",
    hDelivered: "Доставлен", hCancelled: "Отменён", dates: ["12 авг", "28 июл", "14 июл"],
    loading: "Загрузка…", emptyCart: "Корзина пуста", noResults: "Товары не найдены",
    cartCountLabel: (count, total) => `Корзина · ${count} — ${total}`,
    addToCartLabel: (price) => `В корзину — ${price}`,
    placeOrderLabel: (total) => `Оформить заказ — ${total}`,
    wishlistBtn: "❤️ Добавить в желаемое",
    wishlistMsg: "Этого пока нет в наличии — так мы видим, что это интересно. Готовы оплатить полную стоимость сразу? Получите пожизненную скидку 5%. Напишите менеджеру, чтобы договориться.",
    wishlistManagerBtn: "Написать менеджеру",
    orderPlacedTitle: "Заказ оформлен", orderPlacedBody: "Напишем вам сюда с обновлениями.",
    backToCatalog: "К каталогу",
    nameLbl: "Имя", phoneLbl: "Телефон", addressLbl: "Адрес", addressPh: "Улица, квартира, город, индекс",
    aboutBody: "Smoke Finder — устройства для вейпинга и жидкости с никотином в Калгари, AB. Только 18+. Курьер или самовывоз, Interac e-Transfer или наличные при получении, GST 5%.",
    supportUnset: "Контакт поддержки ещё не настроен — попробуйте позже.",
    phoneRequiredHint: "Укажите корректный номер (10 цифр).",
    addressRequiredHint: "Укажите адрес доставки для курьера.",
    etProofNote: "После оформления заказа мы напишем сумму к переводу. Отправьте e-Transfer, затем пришлите нам скриншот — подтвердим, как только увидим.",
    addAddressBtn: "Добавить", noAddresses: "Пока нет сохранённых адресов", deleteBtn: "Удалить",
    myWishlist: "Моё желаемое", myWishlistEmpty: "Вы пока ничего не добавили в желаемое",
    newBadge: "НОВОЕ",
  },
};
