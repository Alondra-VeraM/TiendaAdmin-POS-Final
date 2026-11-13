/**
 * MEGA BASE DE DATOS DE CÓDIGOS DE BARRAS COMUNES EN MÉXICO (ABARROTES / RETAIL)
 * Prefijo GS1 México: 750...
 * Permite autocompletar nombre, marca, categoría, costo sugerido y precio estimado al escanear.
 */
(function(global) {
  const MEXICO_BARCODES = [
    // =========================================================================
    // 1. REFRESCOS Y BEBIDAS
    // =========================================================================
    {
      barcode: "7501055304745",
      name: "Coca-Cola Original 600ml",
      brand: "Coca-Cola",
      category: "Bebidas y Refrescos",
      suggestedCost: 14.00,
      suggestedPrice: 19.00,
      iconType: "soda"
    },
    {
      barcode: "750185538472",
      name: "Coca-Cola Original 600ml",
      brand: "Coca-Cola",
      category: "Bebidas y Refrescos",
      suggestedCost: 14.00,
      suggestedPrice: 19.00,
      iconType: "soda"
    },
    {
      barcode: "7501055365449",
      name: "Coca-Cola Sin Azúcar 600ml",
      brand: "Coca-Cola",
      category: "Bebidas y Refrescos",
      suggestedCost: 14.00,
      suggestedPrice: 19.00,
      iconType: "soda"
    },
    {
      barcode: "7501055303779",
      name: "Coca-Cola Original 2.5L",
      brand: "Coca-Cola",
      category: "Bebidas y Refrescos",
      suggestedCost: 32.00,
      suggestedPrice: 42.00,
      iconType: "soda"
    },
    {
      barcode: "7501055304721",
      name: "Coca-Cola Original 3L No Retornable",
      brand: "Coca-Cola",
      category: "Bebidas y Refrescos",
      suggestedCost: 38.00,
      suggestedPrice: 49.00,
      iconType: "soda"
    },
    {
      barcode: "7501055310883",
      name: "Sprite 600ml",
      brand: "Coca-Cola",
      category: "Bebidas y Refrescos",
      suggestedCost: 13.00,
      suggestedPrice: 18.00,
      iconType: "soda"
    },
    {
      barcode: "7501055311880",
      name: "Fanta Naranja 600ml",
      brand: "Coca-Cola",
      category: "Bebidas y Refrescos",
      suggestedCost: 13.00,
      suggestedPrice: 18.00,
      iconType: "soda"
    },
    {
      barcode: "7501055320882",
      name: "Sidral Mundet Manzana 600ml",
      brand: "Mundet",
      category: "Bebidas y Refrescos",
      suggestedCost: 13.00,
      suggestedPrice: 18.00,
      iconType: "soda"
    },
    {
      barcode: "7501031311309",
      name: "Pepsi Regular 600ml",
      brand: "Pepsi",
      category: "Bebidas y Refrescos",
      suggestedCost: 12.00,
      suggestedPrice: 17.00,
      iconType: "soda"
    },
    {
      barcode: "7501031311682",
      name: "Manzanita Sol 600ml",
      brand: "Pepsi",
      category: "Bebidas y Refrescos",
      suggestedCost: 12.00,
      suggestedPrice: 17.00,
      iconType: "soda"
    },
    {
      barcode: "7501031311408",
      name: "7Up Refresco Lima Limón 600ml",
      brand: "Pepsi",
      category: "Bebidas y Refrescos",
      suggestedCost: 12.00,
      suggestedPrice: 17.00,
      iconType: "soda"
    },
    {
      barcode: "7501071110757",
      name: "Peñafiel Agua Mineral 600ml",
      brand: "Peñafiel",
      category: "Bebidas y Refrescos",
      suggestedCost: 12.50,
      suggestedPrice: 17.50,
      iconType: "soda"
    },
    {
      barcode: "7501071110764",
      name: "Peñafiel Naranjada Twist 600ml",
      brand: "Peñafiel",
      category: "Bebidas y Refrescos",
      suggestedCost: 13.00,
      suggestedPrice: 18.00,
      iconType: "soda"
    },
    {
      barcode: "7501055312115",
      name: "Agua Ciel Purificada 1L",
      brand: "Ciel",
      category: "Bebidas y Refrescos",
      suggestedCost: 9.00,
      suggestedPrice: 13.00,
      iconType: "water"
    },
    {
      barcode: "750456789321",
      name: "Agua Ciel Purificada 1.5L",
      brand: "Ciel",
      category: "Bebidas y Refrescos",
      suggestedCost: 12.00,
      suggestedPrice: 16.00,
      iconType: "water"
    },
    {
      barcode: "7501055305148",
      name: "Agua Ciel Purificada 1.5L",
      brand: "Ciel",
      category: "Bebidas y Refrescos",
      suggestedCost: 12.00,
      suggestedPrice: 16.00,
      iconType: "water"
    },
    {
      barcode: "7501003112217",
      name: "Agua Bonafont Natural 1L",
      brand: "Bonafont",
      category: "Bebidas y Refrescos",
      suggestedCost: 10.00,
      suggestedPrice: 14.50,
      iconType: "water"
    },
    {
      barcode: "7501003112316",
      name: "Agua Bonafont Natural 1.5L",
      brand: "Bonafont",
      category: "Bebidas y Refrescos",
      suggestedCost: 12.50,
      suggestedPrice: 17.00,
      iconType: "water"
    },
    {
      barcode: "7501055313983",
      name: "Jugo Del Valle Manzana 413ml",
      brand: "Del Valle",
      category: "Bebidas y Refrescos",
      suggestedCost: 13.00,
      suggestedPrice: 18.00,
      iconType: "general"
    },
    {
      barcode: "7501013100129",
      name: "Jugo Jumex Mango Néctar 450ml",
      brand: "Jumex",
      category: "Bebidas y Refrescos",
      suggestedCost: 13.50,
      suggestedPrice: 18.50,
      iconType: "general"
    },
    {
      barcode: "7501039811016",
      name: "Boing de Mango Triángulo 500ml",
      brand: "Boing",
      category: "Bebidas y Refrescos",
      suggestedCost: 11.50,
      suggestedPrice: 16.00,
      iconType: "general"
    },
    {
      barcode: "7501039811023",
      name: "Boing de Guayaba 500ml",
      brand: "Boing",
      category: "Bebidas y Refrescos",
      suggestedCost: 11.50,
      suggestedPrice: 16.00,
      iconType: "general"
    },
    {
      barcode: "0613008719041",
      name: "Té Arizona Verde con Miel 680ml",
      brand: "Arizona",
      category: "Bebidas y Refrescos",
      suggestedCost: 14.50,
      suggestedPrice: 20.00,
      iconType: "general"
    },
    {
      barcode: "7501125101015",
      name: "Suero Electrolit Fresa 625ml",
      brand: "Electrolit",
      category: "Bebidas y Refrescos",
      suggestedCost: 22.00,
      suggestedPrice: 32.00,
      iconType: "general"
    },
    {
      barcode: "7501125101039",
      name: "Suero Electrolit Coco 625ml",
      brand: "Electrolit",
      category: "Bebidas y Refrescos",
      suggestedCost: 22.00,
      suggestedPrice: 32.00,
      iconType: "general"
    },
    {
      barcode: "070847012474",
      name: "Monster Energy Bebida Energética 473ml",
      brand: "Monster",
      category: "Bebidas y Refrescos",
      suggestedCost: 32.00,
      suggestedPrice: 45.00,
      iconType: "general"
    },
    {
      barcode: "9002490100070",
      name: "Red Bull Energy Drink 250ml",
      brand: "Red Bull",
      category: "Bebidas y Refrescos",
      suggestedCost: 34.00,
      suggestedPrice: 48.00,
      iconType: "general"
    },

    // =========================================================================
    // 2. LÁCTEOS Y CREMERÍA
    // =========================================================================
    {
      barcode: "7501820511234",
      name: "Leche Lala Entera 1L",
      brand: "Lala",
      category: "Lácteos y Cremería",
      suggestedCost: 22.50,
      suggestedPrice: 29.50,
      iconType: "milk"
    },
    {
      barcode: "7501020511234",
      name: "Leche Lala Entera 1L",
      brand: "Lala",
      category: "Lácteos y Cremería",
      suggestedCost: 22.50,
      suggestedPrice: 29.50,
      iconType: "milk"
    },
    {
      barcode: "7501020511333",
      name: "Leche Lala Deslactosada 1L",
      brand: "Lala",
      category: "Lácteos y Cremería",
      suggestedCost: 24.00,
      suggestedPrice: 31.50,
      iconType: "milk"
    },
    {
      barcode: "7501020511432",
      name: "Leche Lala Semidescremada 1L",
      brand: "Lala",
      category: "Lácteos y Cremería",
      suggestedCost: 22.50,
      suggestedPrice: 29.50,
      iconType: "milk"
    },
    {
      barcode: "7501005112116",
      name: "Leche Alpura Clásica Entera 1L",
      brand: "Alpura",
      category: "Lácteos y Cremería",
      suggestedCost: 23.00,
      suggestedPrice: 30.00,
      iconType: "milk"
    },
    {
      barcode: "7501005112215",
      name: "Leche Alpura Deslactosada 1L",
      brand: "Alpura",
      category: "Lácteos y Cremería",
      suggestedCost: 24.50,
      suggestedPrice: 32.00,
      iconType: "milk"
    },
    {
      barcode: "7501020556129",
      name: "Nutri Leche Pasteurizada 1L",
      brand: "Nutri",
      category: "Lácteos y Cremería",
      suggestedCost: 17.50,
      suggestedPrice: 23.50,
      iconType: "milk"
    },
    {
      barcode: "7501058617309",
      name: "Leche Condensada La Lechera 375g",
      brand: "Nestlé",
      category: "Lácteos y Cremería",
      suggestedCost: 23.00,
      suggestedPrice: 31.00,
      iconType: "milk"
    },
    {
      barcode: "7501058617019",
      name: "Leche Evaporada Carnation Clavel 360g",
      brand: "Nestlé",
      category: "Lácteos y Cremería",
      suggestedCost: 18.00,
      suggestedPrice: 25.00,
      iconType: "milk"
    },
    {
      barcode: "7501020514105",
      name: "Media Crema Lala 250ml",
      brand: "Lala",
      category: "Lácteos y Cremería",
      suggestedCost: 15.00,
      suggestedPrice: 20.50,
      iconType: "milk"
    },
    {
      barcode: "7501058617873",
      name: "Media Crema Nestlé Tetra Pak 225g",
      brand: "Nestlé",
      category: "Lácteos y Cremería",
      suggestedCost: 16.00,
      suggestedPrice: 22.00,
      iconType: "milk"
    },
    {
      barcode: "7501017001019",
      name: "Mantequilla Gloria con Sal 90g",
      brand: "Gloria",
      category: "Lácteos y Cremería",
      suggestedCost: 18.50,
      suggestedPrice: 25.00,
      iconType: "general"
    },
    {
      barcode: "7501032301019",
      name: "Yoghurt Danone Batido Fresa 220g",
      brand: "Danone",
      category: "Lácteos y Cremería",
      suggestedCost: 11.00,
      suggestedPrice: 15.50,
      iconType: "milk"
    },
    {
      barcode: "7501020531010",
      name: "Yoghurt Lala Bebible Fresa 220g",
      brand: "Lala",
      category: "Lácteos y Cremería",
      suggestedCost: 11.50,
      suggestedPrice: 16.00,
      iconType: "milk"
    },
    {
      barcode: "7501007200019",
      name: "Yakult Alimento Lácteo Fermentado 5 Pack",
      brand: "Yakult",
      category: "Lácteos y Cremería",
      suggestedCost: 40.00,
      suggestedPrice: 52.00,
      iconType: "milk"
    },
    {
      barcode: "7501040001019",
      name: "Queso Panela Fud 400g",
      brand: "Fud",
      category: "Lácteos y Cremería",
      suggestedCost: 52.00,
      suggestedPrice: 68.00,
      iconType: "general"
    },
    {
      barcode: "7501040002016",
      name: "Jamón de Pavo Virginia Fud 250g",
      brand: "Fud",
      category: "Lácteos y Cremería",
      suggestedCost: 32.00,
      suggestedPrice: 42.00,
      iconType: "general"
    },
    {
      barcode: "7501040003013",
      name: "Salchicha Viena Fud 500g",
      brand: "Fud",
      category: "Lácteos y Cremería",
      suggestedCost: 34.00,
      suggestedPrice: 45.00,
      iconType: "general"
    },

    // =========================================================================
    // 3. PANADERÍA, GALLETAS Y PASTELITOS
    // =========================================================================
    {
      barcode: "750954123456",
      name: "Pan Blanco Bimbo Grande 680g",
      brand: "Bimbo",
      category: "Panadería",
      suggestedCost: 34.00,
      suggestedPrice: 46.00,
      iconType: "bread"
    },
    {
      barcode: "7501000111206",
      name: "Pan Blanco Bimbo Grande 680g",
      brand: "Bimbo",
      category: "Panadería",
      suggestedCost: 34.00,
      suggestedPrice: 46.00,
      iconType: "bread"
    },
    {
      barcode: "7501000111305",
      name: "Pan Integral Bimbo Grande 680g",
      brand: "Bimbo",
      category: "Panadería",
      suggestedCost: 38.00,
      suggestedPrice: 50.00,
      iconType: "bread"
    },
    {
      barcode: "7501000112104",
      name: "Pan Tostado Clásico Bimbo 210g",
      brand: "Bimbo",
      category: "Panadería",
      suggestedCost: 26.00,
      suggestedPrice: 35.00,
      iconType: "bread"
    },
    {
      barcode: "7501000114108",
      name: "Medias Noches Bimbo 8 pzas",
      brand: "Bimbo",
      category: "Panadería",
      suggestedCost: 34.00,
      suggestedPrice: 44.00,
      iconType: "bread"
    },
    {
      barcode: "7501000114207",
      name: "Pan para Hamburguesa Bimbollos Bimbo 8 pzas",
      brand: "Bimbo",
      category: "Panadería",
      suggestedCost: 38.00,
      suggestedPrice: 49.00,
      iconType: "bread"
    },
    {
      barcode: "7501000121106",
      name: "Tortillinas Tía Rosa 12 pzas 306g",
      brand: "Tía Rosa",
      category: "Panadería",
      suggestedCost: 20.00,
      suggestedPrice: 28.00,
      iconType: "bread"
    },
    {
      barcode: "7501000133109",
      name: "Gansito Marinela 50g",
      brand: "Marinela",
      category: "Panadería",
      suggestedCost: 14.50,
      suggestedPrice: 20.00,
      iconType: "bread"
    },
    {
      barcode: "7501000133208",
      name: "Pingüinos Marinela 2 pzas 80g",
      brand: "Marinela",
      category: "Panadería",
      suggestedCost: 18.00,
      suggestedPrice: 25.00,
      iconType: "bread"
    },
    {
      barcode: "7501000133307",
      name: "Chocoroles Marinela 2 pzas 80g",
      brand: "Marinela",
      category: "Panadería",
      suggestedCost: 18.00,
      suggestedPrice: 25.00,
      iconType: "bread"
    },
    {
      barcode: "7501000133406",
      name: "Submarinos Marinela Vainilla 105g",
      brand: "Marinela",
      category: "Panadería",
      suggestedCost: 16.00,
      suggestedPrice: 22.00,
      iconType: "bread"
    },
    {
      barcode: "7501000133505",
      name: "Barritas Fresa Marinela 67g",
      brand: "Marinela",
      category: "Panadería",
      suggestedCost: 15.00,
      suggestedPrice: 21.00,
      iconType: "bread"
    },
    {
      barcode: "7501000611019",
      name: "Galletas Marías Gamesa 170g",
      brand: "Gamesa",
      category: "Panadería",
      suggestedCost: 14.00,
      suggestedPrice: 19.50,
      iconType: "bread"
    },
    {
      barcode: "7501000611217",
      name: "Galletas Emperador Chocolate 101g",
      brand: "Gamesa",
      category: "Panadería",
      suggestedCost: 15.00,
      suggestedPrice: 21.00,
      iconType: "bread"
    },
    {
      barcode: "7501000611316",
      name: "Galletas Emperador Limón 101g",
      brand: "Gamesa",
      category: "Panadería",
      suggestedCost: 15.00,
      suggestedPrice: 21.00,
      iconType: "bread"
    },
    {
      barcode: "7501000611415",
      name: "Galletas Chokis Clásicas 84g",
      brand: "Gamesa",
      category: "Panadería",
      suggestedCost: 15.00,
      suggestedPrice: 21.00,
      iconType: "bread"
    },
    {
      barcode: "7622210201019",
      name: "Galletas Oreo Original 114g",
      brand: "Oreo",
      category: "Panadería",
      suggestedCost: 15.50,
      suggestedPrice: 22.00,
      iconType: "bread"
    },
    {
      barcode: "7501000611514",
      name: "Galletas Saladitas Gamesa 186g",
      brand: "Gamesa",
      category: "Panadería",
      suggestedCost: 16.00,
      suggestedPrice: 23.00,
      iconType: "bread"
    },
    {
      barcode: "7501000611613",
      name: "Galletas Crackets Gamesa 135g",
      brand: "Gamesa",
      category: "Panadería",
      suggestedCost: 15.00,
      suggestedPrice: 21.00,
      iconType: "bread"
    },

    // =========================================================================
    // 4. BOTANAS Y DULCES
    // =========================================================================
    {
      barcode: "750147258369",
      name: "Sabritas Original con Sal 45g",
      brand: "Sabritas",
      category: "Botanas",
      suggestedCost: 14.00,
      suggestedPrice: 19.50,
      iconType: "general"
    },
    {
      barcode: "7501011115512",
      name: "Sabritas Original con Sal 45g",
      brand: "Sabritas",
      category: "Botanas",
      suggestedCost: 14.00,
      suggestedPrice: 19.50,
      iconType: "general"
    },
    {
      barcode: "7501011115611",
      name: "Ruffles Queso 48g",
      brand: "Sabritas",
      category: "Botanas",
      suggestedCost: 14.50,
      suggestedPrice: 20.00,
      iconType: "general"
    },
    {
      barcode: "7501011115710",
      name: "Doritos Nacho 58g",
      brand: "Sabritas",
      category: "Botanas",
      suggestedCost: 14.50,
      suggestedPrice: 20.00,
      iconType: "general"
    },
    {
      barcode: "7501011115819",
      name: "Cheetos Torciditos Queso 52g",
      brand: "Sabritas",
      category: "Botanas",
      suggestedCost: 12.00,
      suggestedPrice: 17.00,
      iconType: "general"
    },
    {
      barcode: "7501011115918",
      name: "Cheetos Flamin Hot 52g",
      brand: "Sabritas",
      category: "Botanas",
      suggestedCost: 12.00,
      suggestedPrice: 17.00,
      iconType: "general"
    },
    {
      barcode: "7501011116014",
      name: "Tostitos Salsa Verde 65g",
      brand: "Sabritas",
      category: "Botanas",
      suggestedCost: 14.50,
      suggestedPrice: 20.00,
      iconType: "general"
    },
    {
      barcode: "7501011116113",
      name: "Fritos Sal y Limón 57g",
      brand: "Sabritas",
      category: "Botanas",
      suggestedCost: 13.00,
      suggestedPrice: 18.00,
      iconType: "general"
    },
    {
      barcode: "7501011116212",
      name: "Rancheritos Frituras 58g",
      brand: "Sabritas",
      category: "Botanas",
      suggestedCost: 13.00,
      suggestedPrice: 18.00,
      iconType: "general"
    },
    {
      barcode: "7501011116311",
      name: "Cacahuates Sabritas Salados 42g",
      brand: "Sabritas",
      category: "Botanas",
      suggestedCost: 12.00,
      suggestedPrice: 17.00,
      iconType: "general"
    },
    {
      barcode: "7501000241019",
      name: "Takis Fuego Barcel 56g",
      brand: "Barcel",
      category: "Botanas",
      suggestedCost: 14.00,
      suggestedPrice: 19.50,
      iconType: "general"
    },
    {
      barcode: "7501000242016",
      name: "Chips Jalapeño Barcel 55g",
      brand: "Barcel",
      category: "Botanas",
      suggestedCost: 16.00,
      suggestedPrice: 22.00,
      iconType: "general"
    },
    {
      barcode: "7501000243013",
      name: "Hot Nuts Barcel Cacahuates Original 50g",
      brand: "Barcel",
      category: "Botanas",
      suggestedCost: 13.00,
      suggestedPrice: 18.00,
      iconType: "general"
    },
    {
      barcode: "7501004111019",
      name: "Mazapán De la Rosa Original 28g",
      brand: "De la Rosa",
      category: "Botanas",
      suggestedCost: 5.50,
      suggestedPrice: 9.00,
      iconType: "general"
    },
    {
      barcode: "7501011111019",
      name: "Pelón Pelo Rico Tamarindo 30g",
      brand: "Pelón",
      category: "Botanas",
      suggestedCost: 7.00,
      suggestedPrice: 11.00,
      iconType: "general"
    },
    {
      barcode: "7501011121018",
      name: "Paleta Payaso Ricolino 45g",
      brand: "Ricolino",
      category: "Botanas",
      suggestedCost: 14.00,
      suggestedPrice: 19.00,
      iconType: "general"
    },
    {
      barcode: "7501011122015",
      name: "Bubu Lubu Ricolino 35g",
      brand: "Ricolino",
      category: "Botanas",
      suggestedCost: 8.50,
      suggestedPrice: 13.00,
      iconType: "general"
    },
    {
      barcode: "7501058611017",
      name: "Chocolate Carlos V Suizo 18g",
      brand: "Nestlé",
      category: "Botanas",
      suggestedCost: 8.00,
      suggestedPrice: 12.00,
      iconType: "general"
    },
    {
      barcode: "7501058611116",
      name: "Chocolate Abuelita Tableta 90g",
      brand: "Nestlé",
      category: "Botanas",
      suggestedCost: 18.00,
      suggestedPrice: 25.00,
      iconType: "general"
    },

    // =========================================================================
    // 5. ABARROTES, GRANOS Y ENLATADOS
    // =========================================================================
    {
      barcode: "750103912089",
      name: "Aceite Nutrioli Puro de Soya 850ml",
      brand: "Nutrioli",
      category: "Abarrotes y Granos",
      suggestedCost: 36.00,
      suggestedPrice: 46.00,
      iconType: "general"
    },
    {
      barcode: "7501039120890",
      name: "Aceite Nutrioli Puro de Soya 850ml",
      brand: "Nutrioli",
      category: "Abarrotes y Granos",
      suggestedCost: 36.00,
      suggestedPrice: 46.00,
      iconType: "general"
    },
    {
      barcode: "7501039110013",
      name: "Aceite 1-2-3 Mixto 1L",
      brand: "1-2-3",
      category: "Abarrotes y Granos",
      suggestedCost: 34.00,
      suggestedPrice: 43.50,
      iconType: "general"
    },
    {
      barcode: "7501006500127",
      name: "Aceite Capullo Puro de Canola 840ml",
      brand: "Capullo",
      category: "Abarrotes y Granos",
      suggestedCost: 46.00,
      suggestedPrice: 58.00,
      iconType: "general"
    },
    {
      barcode: "750188881235",
      name: "Huevo Blanco San Juan 1kg",
      brand: "San Juan",
      category: "Abarrotes y Granos",
      suggestedCost: 42.00,
      suggestedPrice: 52.00,
      iconType: "egg"
    },
    {
      barcode: "7501888812351",
      name: "Huevo Blanco San Juan 1kg",
      brand: "San Juan",
      category: "Abarrotes y Granos",
      suggestedCost: 42.00,
      suggestedPrice: 52.00,
      iconType: "egg"
    },
    {
      barcode: "7501888821810",
      name: "Huevo Blanco San Juan Cono 18 pzas",
      brand: "San Juan",
      category: "Abarrotes y Granos",
      suggestedCost: 48.00,
      suggestedPrice: 62.00,
      iconType: "egg"
    },
    {
      barcode: "7501045401019",
      name: "Atún Dolores en Agua Aleta Amarilla 140g",
      brand: "Dolores",
      category: "Abarrotes y Granos",
      suggestedCost: 17.50,
      suggestedPrice: 23.50,
      iconType: "general"
    },
    {
      barcode: "7501045401026",
      name: "Atún Dolores en Aceite 140g",
      brand: "Dolores",
      category: "Abarrotes y Granos",
      suggestedCost: 17.50,
      suggestedPrice: 23.50,
      iconType: "general"
    },
    {
      barcode: "7501013601015",
      name: "Atún Tuny Clásico en Agua 140g",
      brand: "Tuny",
      category: "Abarrotes y Granos",
      suggestedCost: 16.50,
      suggestedPrice: 22.50,
      iconType: "general"
    },
    {
      barcode: "7501071301018",
      name: "Frijoles Negros Refritos Isadora 430g",
      brand: "Isadora",
      category: "Abarrotes y Granos",
      suggestedCost: 16.00,
      suggestedPrice: 22.00,
      iconType: "general"
    },
    {
      barcode: "7501017002016",
      name: "Frijoles Bayos Refritos La Costeña 400g",
      brand: "La Costeña",
      category: "Abarrotes y Granos",
      suggestedCost: 15.50,
      suggestedPrice: 21.00,
      iconType: "general"
    },
    {
      barcode: "7501017003013",
      name: "Chiles Jalapeños Enteros La Costeña 220g",
      brand: "La Costeña",
      category: "Abarrotes y Granos",
      suggestedCost: 13.00,
      suggestedPrice: 18.00,
      iconType: "general"
    },
    {
      barcode: "7501005101011",
      name: "Mayonesa McCormick con Jugo de Limón 390g",
      brand: "McCormick",
      category: "Abarrotes y Granos",
      suggestedCost: 38.00,
      suggestedPrice: 49.00,
      iconType: "general"
    },
    {
      barcode: "7501017004010",
      name: "Salsa Catsup La Costeña 320g",
      brand: "La Costeña",
      category: "Abarrotes y Granos",
      suggestedCost: 16.00,
      suggestedPrice: 22.00,
      iconType: "general"
    },
    {
      barcode: "7501006501018",
      name: "Puré de Tomate Condimentado Del Fuerte 210g",
      brand: "Del Fuerte",
      category: "Abarrotes y Granos",
      suggestedCost: 7.50,
      suggestedPrice: 11.50,
      iconType: "general"
    },
    {
      barcode: "041789001214",
      name: "Sopa Maruchan Instant Lunch Pollo 64g",
      brand: "Maruchan",
      category: "Abarrotes y Granos",
      suggestedCost: 12.00,
      suggestedPrice: 17.50,
      iconType: "general"
    },
    {
      barcode: "041789001221",
      name: "Sopa Maruchan Instant Lunch Camarón Limón y Chile 64g",
      brand: "Maruchan",
      category: "Abarrotes y Granos",
      suggestedCost: 12.00,
      suggestedPrice: 17.50,
      iconType: "general"
    },
    {
      barcode: "041789001238",
      name: "Sopa Maruchan Instant Lunch Carne de Res 64g",
      brand: "Maruchan",
      category: "Abarrotes y Granos",
      suggestedCost: 12.00,
      suggestedPrice: 17.50,
      iconType: "general"
    },
    {
      barcode: "7501018301019",
      name: "Pasta Spaguetti La Moderna 200g",
      brand: "La Moderna",
      category: "Abarrotes y Granos",
      suggestedCost: 7.50,
      suggestedPrice: 11.00,
      iconType: "general"
    },
    {
      barcode: "7501018301026",
      name: "Pasta Codo No. 2 La Moderna 200g",
      brand: "La Moderna",
      category: "Abarrotes y Granos",
      suggestedCost: 7.50,
      suggestedPrice: 11.00,
      iconType: "general"
    },
    {
      barcode: "750741852963",
      name: "Arroz Morelos Schettino 1kg",
      brand: "Schettino",
      category: "Abarrotes y Granos",
      suggestedCost: 19.00,
      suggestedPrice: 26.50,
      iconType: "general"
    },
    {
      barcode: "750369258147",
      name: "Frijol Pinto Verde Valle 1kg",
      brand: "Verde Valle",
      category: "Abarrotes y Granos",
      suggestedCost: 28.00,
      suggestedPrice: 38.00,
      iconType: "general"
    },
    {
      barcode: "7501071302015",
      name: "Frijol Negro Verde Valle 1kg",
      brand: "Verde Valle",
      category: "Abarrotes y Granos",
      suggestedCost: 29.00,
      suggestedPrice: 39.50,
      iconType: "general"
    },
    {
      barcode: "7501042501012",
      name: "Azúcar Zulka Estándar 1kg",
      brand: "Zulka",
      category: "Abarrotes y Granos",
      suggestedCost: 26.00,
      suggestedPrice: 34.00,
      iconType: "general"
    },
    {
      barcode: "7501001501013",
      name: "Sal Yodada y Fluorurada La Fina 1kg",
      brand: "La Fina",
      category: "Abarrotes y Granos",
      suggestedCost: 13.00,
      suggestedPrice: 18.00,
      iconType: "general"
    },
    {
      barcode: "7501058614018",
      name: "Café Soluble Nescafé Clásico 120g",
      brand: "Nescafé",
      category: "Abarrotes y Granos",
      suggestedCost: 65.00,
      suggestedPrice: 85.00,
      iconType: "general"
    },
    {
      barcode: "7501014301013",
      name: "Café Tostado y Molido Legal con Canela 200g",
      brand: "Legal",
      category: "Abarrotes y Granos",
      suggestedCost: 32.00,
      suggestedPrice: 42.00,
      iconType: "general"
    },
    {
      barcode: "7501008001011",
      name: "Modificador de Leche Choco Milk 400g",
      brand: "Choco Milk",
      category: "Abarrotes y Granos",
      suggestedCost: 38.00,
      suggestedPrice: 49.00,
      iconType: "general"
    },
    {
      barcode: "7501008011010",
      name: "Cereal Kellogg's Zucaritas 300g",
      brand: "Kellogg's",
      category: "Abarrotes y Granos",
      suggestedCost: 36.00,
      suggestedPrice: 48.00,
      iconType: "general"
    },
    {
      barcode: "7501008012017",
      name: "Cereal Kellogg's Choco Krispis 310g",
      brand: "Kellogg's",
      category: "Abarrotes y Granos",
      suggestedCost: 36.00,
      suggestedPrice: 48.00,
      iconType: "general"
    },

    // =========================================================================
    // 6. LIMPIEZA E HIGIENE PERSONAL
    // =========================================================================
    {
      barcode: "750258369147",
      name: "Jabón de Lavandería Zote Rosa 200g",
      brand: "La Corona",
      category: "Limpieza e Higiene",
      suggestedCost: 12.00,
      suggestedPrice: 17.50,
      iconType: "general"
    },
    {
      barcode: "7501026001012",
      name: "Jabón de Lavandería Zote Rosa 200g",
      brand: "La Corona",
      category: "Limpieza e Higiene",
      suggestedCost: 12.00,
      suggestedPrice: 17.50,
      iconType: "general"
    },
    {
      barcode: "7501026001029",
      name: "Jabón de Lavandería Zote Blanco 200g",
      brand: "La Corona",
      category: "Limpieza e Higiene",
      suggestedCost: 12.00,
      suggestedPrice: 17.50,
      iconType: "general"
    },
    {
      barcode: "7501026002019",
      name: "Detergente en Polvo Roma 1kg",
      brand: "La Corona",
      category: "Limpieza e Higiene",
      suggestedCost: 28.00,
      suggestedPrice: 38.00,
      iconType: "general"
    },
    {
      barcode: "7501026003016",
      name: "Detergente en Polvo Foca 1kg",
      brand: "La Corona",
      category: "Limpieza e Higiene",
      suggestedCost: 30.00,
      suggestedPrice: 41.00,
      iconType: "general"
    },
    {
      barcode: "7501001151010",
      name: "Detergente en Polvo Ariel Doble Poder 1kg",
      brand: "Ariel",
      category: "Limpieza e Higiene",
      suggestedCost: 38.00,
      suggestedPrice: 49.00,
      iconType: "general"
    },
    {
      barcode: "7501001152017",
      name: "Suavizante Downy Libre Enjuague Floral 750ml",
      brand: "Downy",
      category: "Limpieza e Higiene",
      suggestedCost: 20.00,
      suggestedPrice: 28.00,
      iconType: "general"
    },
    {
      barcode: "7501025401011",
      name: "Blanqueador Cloralex El Rendidor 950ml",
      brand: "Cloralex",
      category: "Limpieza e Higiene",
      suggestedCost: 14.50,
      suggestedPrice: 20.00,
      iconType: "general"
    },
    {
      barcode: "7501025402018",
      name: "Limpiador Multiusos Pinol Original 1L",
      brand: "Pinol",
      category: "Limpieza e Higiene",
      suggestedCost: 22.00,
      suggestedPrice: 30.00,
      iconType: "general"
    },
    {
      barcode: "7501035901019",
      name: "Limpiador Fabuloso Lavanda Fresca 1L",
      brand: "Fabuloso",
      category: "Limpieza e Higiene",
      suggestedCost: 21.00,
      suggestedPrice: 29.00,
      iconType: "general"
    },
    {
      barcode: "7501001153014",
      name: "Lavatrastes Líquido Salvo Limón 750ml",
      brand: "Salvo",
      category: "Limpieza e Higiene",
      suggestedCost: 32.00,
      suggestedPrice: 42.00,
      iconType: "general"
    },
    {
      barcode: "750369147258",
      name: "Papel Higiénico Suavel 4 Rollos",
      brand: "Suavel",
      category: "Limpieza e Higiene",
      suggestedCost: 20.00,
      suggestedPrice: 28.00,
      iconType: "general"
    },
    {
      barcode: "7501019001012",
      name: "Papel Higiénico Suavel 4 Rollos",
      brand: "Suavel",
      category: "Limpieza e Higiene",
      suggestedCost: 20.00,
      suggestedPrice: 28.00,
      iconType: "general"
    },
    {
      barcode: "7501019002019",
      name: "Papel Higiénico Pétalo Family Balance 4 Rollos",
      brand: "Pétalo",
      category: "Limpieza e Higiene",
      suggestedCost: 24.00,
      suggestedPrice: 33.00,
      iconType: "general"
    },
    {
      barcode: "7501019003016",
      name: "Papel Higiénico Regio Rinde+ 4 Rollos",
      brand: "Regio",
      category: "Limpieza e Higiene",
      suggestedCost: 28.00,
      suggestedPrice: 38.00,
      iconType: "general"
    },
    {
      barcode: "7501019004013",
      name: "Servilletas de Papel Pétalo 100 pzas",
      brand: "Pétalo",
      category: "Limpieza e Higiene",
      suggestedCost: 18.00,
      suggestedPrice: 25.00,
      iconType: "general"
    },
    {
      barcode: "7501035902016",
      name: "Jabón de Tocador Palmolive Clásico 100g",
      brand: "Palmolive",
      category: "Limpieza e Higiene",
      suggestedCost: 12.00,
      suggestedPrice: 17.00,
      iconType: "general"
    },
    {
      barcode: "7501026004013",
      name: "Jabón de Tocador Rosa Venus 100g",
      brand: "La Corona",
      category: "Limpieza e Higiene",
      suggestedCost: 9.00,
      suggestedPrice: 14.00,
      iconType: "general"
    },
    {
      barcode: "7501035903013",
      name: "Pasta Dental Colgate Triple Acción 100ml",
      brand: "Colgate",
      category: "Limpieza e Higiene",
      suggestedCost: 22.00,
      suggestedPrice: 30.00,
      iconType: "general"
    },
    {
      barcode: "7501056302014",
      name: "Desodorante Rexona Men Aerosol Antibacterial 90g",
      brand: "Rexona",
      category: "Limpieza e Higiene",
      suggestedCost: 46.00,
      suggestedPrice: 59.00,
      iconType: "general"
    },
    {
      barcode: "7501019005010",
      name: "Toallas Femeninas Saba Clásica con Alas 10 pzas",
      brand: "Saba",
      category: "Limpieza e Higiene",
      suggestedCost: 22.00,
      suggestedPrice: 30.00,
      iconType: "general"
    },
    {
      barcode: "7501001154011",
      name: "Rastrillo Gillette Prestobarba 3 (1 pza)",
      brand: "Gillette",
      category: "Limpieza e Higiene",
      suggestedCost: 18.00,
      suggestedPrice: 25.00,
      iconType: "general"
    },
    {
      barcode: "070330000010",
      name: "Encendedor Bic Clásico Maxi",
      brand: "Bic",
      category: "Otros",
      suggestedCost: 16.00,
      suggestedPrice: 23.00,
      iconType: "general"
    },
    {
      barcode: "041333001012",
      name: "Pilas Duracell Alcalinas AA 2 pzas",
      brand: "Duracell",
      category: "Otros",
      suggestedCost: 42.00,
      suggestedPrice: 56.00,
      iconType: "general"
    },

    // =========================================================================
    // 7. CERVEZAS Y BEBIDAS
    // =========================================================================
    {
      barcode: "7501064111019",
      name: "Cerveza Corona Extra Media 355ml",
      brand: "Corona",
      category: "Bebidas y Refrescos",
      suggestedCost: 16.50,
      suggestedPrice: 23.00,
      iconType: "soda"
    },
    {
      barcode: "7501064112016",
      name: "Cerveza Victoria Media 355ml",
      brand: "Victoria",
      category: "Bebidas y Refrescos",
      suggestedCost: 16.50,
      suggestedPrice: 23.00,
      iconType: "soda"
    },
    {
      barcode: "7501064113013",
      name: "Cerveza Modelo Especial Media 355ml",
      brand: "Modelo",
      category: "Bebidas y Refrescos",
      suggestedCost: 18.00,
      suggestedPrice: 25.00,
      iconType: "soda"
    },
    {
      barcode: "7501064121018",
      name: "Cerveza Tecate Original Lata 355ml",
      brand: "Tecate",
      category: "Bebidas y Refrescos",
      suggestedCost: 17.00,
      suggestedPrice: 24.00,
      iconType: "soda"
    },

    // =========================================================================
    // 8. CÓDIGOS PADRE COMUNES (CAJAS / PAQUETES CERRADOS)
    // =========================================================================
    {
      barcode: "17501820511231",
      name: "Caja Leche Lala Entera 1L (12 piezas)",
      brand: "Lala",
      category: "Lácteos y Cremería",
      isPackage: true,
      parentOfBarcode: "7501820511234",
      unitsPerPackage: 12,
      suggestedCost: 264.00,
      suggestedPrice: 354.00,
      iconType: "milk"
    },
    {
      barcode: "17501855384729",
      name: "Caja Coca-Cola Original 600ml (24 piezas)",
      brand: "Coca-Cola",
      category: "Bebidas y Refrescos",
      isPackage: true,
      parentOfBarcode: "750185538472",
      unitsPerPackage: 24,
      suggestedCost: 336.00,
      suggestedPrice: 456.00,
      iconType: "soda"
    },
    {
      barcode: "17501039120897",
      name: "Caja Aceite Nutrioli 850ml (12 piezas)",
      brand: "Nutrioli",
      category: "Abarrotes y Granos",
      isPackage: true,
      parentOfBarcode: "750103912089",
      unitsPerPackage: 12,
      suggestedCost: 432.00,
      suggestedPrice: 552.00,
      iconType: "general"
    },
    {
      barcode: "17509541234563",
      name: "Caja Pan Bimbo Blanco 680g (10 piezas)",
      brand: "Bimbo",
      category: "Panadería",
      isPackage: true,
      parentOfBarcode: "750954123456",
      unitsPerPackage: 10,
      suggestedCost: 340.00,
      suggestedPrice: 460.00,
      iconType: "bread"
    }
  ];

  // Índice rápido por código de barras
  const BARCODE_MAP = new Map();
  MEXICO_BARCODES.forEach(item => {
    BARCODE_MAP.set(item.barcode.trim(), item);
  });

  /**
   * Busca un producto en el mega catálogo mexicano por código de barras
   * @param {string} code Código EAN-13 o UPC
   * @returns {object|null}
   */
  function lookupMexicoBarcode(code) {
    if (!code) return null;
    const clean = String(code).trim();
    if (BARCODE_MAP.has(clean)) {
      return JSON.parse(JSON.stringify(BARCODE_MAP.get(clean)));
    }
    // Búsqueda sin ceros a la izquierda (UPC vs EAN)
    const stripped = clean.replace(/^0+/, '');
    for (const [k, v] of BARCODE_MAP.entries()) {
      if (k.replace(/^0+/, '') === stripped) {
        return JSON.parse(JSON.stringify(v));
      }
    }
    return null;
  }

  // Exportar al objeto global
  global.MEXICO_BARCODES = MEXICO_BARCODES;
  global.lookupMexicoBarcode = lookupMexicoBarcode;

})(typeof window !== 'undefined' ? window : global);

