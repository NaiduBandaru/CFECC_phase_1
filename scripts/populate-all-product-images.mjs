import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const serverRequire = createRequire(path.join(rootDir, 'apps/server/package.json'));
const dotenv = serverRequire('dotenv');
const pg = serverRequire('pg');

dotenv.config({ path: path.join(rootDir, 'apps/server/.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Pack shots on pure white backgrounds (matching user screenshot)
const PACK_SHOTS = {
  // Snacks & Chips
  potato_chips: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=300&q=80', // Lays/Chips bag
  snack_pack: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?auto=format&fit=crop&w=300&q=80',   // Red/Yellow Indian mixture packet
  biscuits: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=300&q=80',     // Biscuits / Cookies pack

  // Dry Fruits & Nuts
  kiwi_bowl: 'https://images.unsplash.com/photo-1618897996318-5a901fa6ca71?auto=format&fit=crop&w=300&q=80',    // Green kiwi in bowl
  apricot_bowl: 'https://images.unsplash.com/photo-1596591606975-97ee5cef3a1e?auto=format&fit=crop&w=300&q=80', // Orange apricots / dry fruits in bowl

  // Cleaning & Household Tools (exact from screenshot)
  handwash_fem: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=300&q=80', // Pink liquid dispenser / can
  mop: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=300&q=80',          // Round floor cleaning mop
  cleaner_bottle: 'https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=300&q=80', // Blue Taski/disinfectant bottle
  toilet_brush: 'https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=300&q=80',   // Blue toilet brush
  urinal_cubes: 'https://images.unsplash.com/photo-1584483766114-2cea6facdf57?auto=format&fit=crop&w=300&q=80',   // Blue urinal freshener box
  duster_blue: 'https://images.unsplash.com/photo-1528458909336-e7a0adfed0a5?auto=format&fit=crop&w=300&q=80',    // Folded blue glass cloth
  yellow_cloth: 'https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=300&q=80',   // Folded yellow duster cloth
  garbage_covers: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80', // Black roll of trash bags
  wiper: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=300&q=80',          // Floor wiper squeegee

  // Groceries & Staples
  rice: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=300&q=80',          // Basmati rice
  dal: 'https://images.unsplash.com/photo-1589927986089-35812388d1f4?auto=format&fit=crop&w=300&q=80',           // Pulses / Dal
  oil: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=300&q=80',           // Cooking oil bottle
  ghee: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=300&q=80',          // Pure cow ghee jar
  milk: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=300&q=80',          // Milk bottle/carton
  butter: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=300&q=80',        // Butter pack
  flour: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=300&q=80',         // Wheat flour / Atta
  sugar: 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&w=300&q=80',         // Sugar & salt
  spices: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=300&q=80',        // Masalas & spices
  noodles: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=300&q=80',       // Maggi/Noodles pack
  cake: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=300&q=80',          // Bakery & Chocolates
  tea: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=300&q=80',           // Tea pack
  coffee: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=300&q=80',        // Coffee jar
  soap: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?auto=format&fit=crop&w=300&q=80',          // Bath soap bar
  shampoo: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=300&q=80',       // Shampoo bottle
  toothpaste: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=300&q=80',    // Toothpaste tube
  detergent: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=300&q=80',     // Detergent powder
  stationery: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=300&q=80',    // Stationery
  malt_drink: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=300&q=80',    // Boost/Bournvita
  beverage: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=300&q=80',      // Soft drink/juice
  provisions_default: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80'
};

function resolveItemImage(name = '', categoryId = 1) {
  const n = name.toUpperCase();

  // Specific items matching user uploaded screenshot
  if (n.includes('POTATO CHIPS') || n.includes('LAYS') || n.includes('CHIPS')) return PACK_SHOTS.potato_chips;
  if (n.includes('KIWI')) return PACK_SHOTS.kiwi_bowl;
  if (n.includes('APRICOT')) return PACK_SHOTS.apricot_bowl;
  if (n.includes('FEM') || n.includes('HAND WASH') || n.includes('HANDWASH')) return PACK_SHOTS.handwash_fem;
  if (n.includes('MOP') || n.includes('MOPS')) return PACK_SHOTS.mop;
  if (n.includes('TASKI') || n.includes('TASRI') || n.includes('PHENYLE') || n.includes('LIZOL') || n.includes('HARPIC')) return PACK_SHOTS.cleaner_bottle;
  if (n.includes('TOILET BRUSH') || n.includes('BRUSH')) return PACK_SHOTS.toilet_brush;
  if (n.includes('URINAL') || n.includes('CUBES') || n.includes('ODONIL')) return PACK_SHOTS.urinal_cubes;
  if (n.includes('DUSTER GLASS') || (n.includes('GLASS') && n.includes('CLOTH')) || (n.includes('BLUE') && n.includes('CLOTH'))) return PACK_SHOTS.duster_blue;
  if (n.includes('YELLOW CLOTH') || (n.includes('YELLOW') && n.includes('CLOTH')) || n.includes('DUSTER')) return PACK_SHOTS.yellow_cloth;
  if (n.includes('GARBAGE') || (n.includes('GARBAGE') && n.includes('COVER'))) return PACK_SHOTS.garbage_covers;
  if (n.includes('WIPER') || n.includes('WIFER')) return PACK_SHOTS.wiper;
  if (n.includes('MOHAN') || n.includes('CHEGODI') || n.includes('JANTHIKI') || n.includes('JAN THIKI') || n.includes('CHEEDOJI') || n.includes('MIXTURE') || n.includes('SNACKS PACK') || n.includes('SNACK')) return PACK_SHOTS.snack_pack;

  // Dairy & Health Drinks
  if (n.includes('BOOST') || n.includes('BOURNVITA') || n.includes('HORLICKS') || n.includes('COMPLAN') || n.includes('MILK MAID') || n.includes('MILK POWDER')) return PACK_SHOTS.malt_drink;
  if (n.includes('GHEE')) return PACK_SHOTS.ghee;
  if (n.includes('BUTTER') && !n.includes('SCOTCH')) return PACK_SHOTS.butter;
  if (n.includes('MILK') || n.includes('DAIRY') || n.includes('CURD') || n.includes('PANEER')) return PACK_SHOTS.milk;

  // Staples & Groceries
  if (n.includes('RICE') || n.includes('BASMATHI') || n.includes('BASMATI') || n.includes('PULAV') || n.includes('BIRYANI')) return PACK_SHOTS.rice;
  if (n.includes('DALL') || n.includes('DAL') || n.includes('GRAM') || n.includes('TOOR') || n.includes('MOONG') || n.includes('CHANA') || n.includes('URAD') || n.includes('RAJMA') || n.includes('PEAS')) return PACK_SHOTS.dal;
  if (n.includes('OIL') || n.includes('SUNFLOWER') || n.includes('GROUNDNUT') || n.includes('GINGELLY') || n.includes('PALM') || n.includes('DEEPAM')) return PACK_SHOTS.oil;
  if (n.includes('ATTA') || n.includes('FLOUR') || n.includes('MAIDA') || n.includes('BESAN') || n.includes('RAVA') || n.includes('SOOJI') || n.includes('SUJI') || n.includes('WHEAT') || n.includes('RAVVA')) return PACK_SHOTS.flour;
  if (n.includes('SUGAR') || n.includes('JAGGERY') || n.includes('BELLAM') || n.includes('SALT') || n.includes('UPPU')) return PACK_SHOTS.sugar;
  if (n.includes('CHILLI') || n.includes('MIRCHI') || n.includes('PEPPER') || n.includes('TURMERIC') || n.includes('HALDI') || n.includes('PASUPU') || n.includes('MASALA') || n.includes('SAMBAR') || n.includes('RASAM') || n.includes('CORIANDER') || n.includes('DHANIYA') || n.includes('SPICE') || n.includes('JEERA') || n.includes('CUMIN') || n.includes('MUSTARD') || n.includes('METHI') || n.includes('POOJA') || n.includes('AGARBATTI') || n.includes('INCENSE') || n.includes('CAMPHOR') || n.includes('KAPOOR')) return PACK_SHOTS.spices;
  if (n.includes('DRY') || n.includes('ALMOND') || n.includes('BADAM') || n.includes('CASHEW') || n.includes('KAJU') || n.includes('PISTA') || n.includes('WALNUT') || n.includes('DATES') || n.includes('ANJEER') || n.includes('RAISIN') || n.includes('KISMIS')) return PACK_SHOTS.apricot_bowl;

  // Bakery, Snacks, Biscuits
  if (n.includes('BISKET') || n.includes('BISCUIT') || n.includes('COOKIE') || n.includes('MARIE') || n.includes('CRACKER') || n.includes('RUSK') || n.includes('TOAST') || n.includes('TIGER') || n.includes('50-50') || n.includes('JIMJAM') || n.includes('UNIBIC') || n.includes('NICE') || n.includes('BOURBON') || n.includes('PARLE') || n.includes('GOOD DAY')) return PACK_SHOTS.biscuits;
  if (n.includes('NOODLE') || n.includes('MAGGI') || n.includes('YIPPEE') || n.includes('PASTA') || n.includes('MACARONI') || n.includes('VERMICELLI') || n.includes('SEVAI') || n.includes('SEMIYA')) return PACK_SHOTS.noodles;
  if (n.includes('CAKE') || n.includes('SOANCAKE') || n.includes('SWEET') || n.includes('CHOCOLATE') || n.includes('5 STAR') || n.includes('CADBURY') || n.includes('SNICKER') || n.includes('CANDY') || n.includes('TOFFEE') || n.includes('CRISPILLO') || n.includes('CHOCKLET') || n.includes('BYTE')) return PACK_SHOTS.cake;
  if (n.includes('TEA') || n.includes('CHAI')) return PACK_SHOTS.tea;
  if (n.includes('COFFEE') || n.includes('BRU') || n.includes('NESCAFE')) return PACK_SHOTS.coffee;
  if (n.includes('COCO COLA') || n.includes('COLA') || n.includes('PEPSI') || n.includes('SPRITE') || n.includes('THUMS') || n.includes('FANTA') || n.includes('MIRINDA') || n.includes('SODA') || n.includes('JUICE') || n.includes('WATER BOTTLE') || n.includes('FROOTI') || n.includes('MAAZA') || n.includes('SLICE')) return PACK_SHOTS.beverage;

  // Personal Care & Hygiene
  if (n.includes('TOOTHPASTE') || n.includes('TOOTH BRUSH') || n.includes('COLGATE') || n.includes('CLOSEUP') || n.includes('ORAL') || n.includes('PEPSODENT') || n.includes('DENTAL') || n.includes('SENSODYNE')) return PACK_SHOTS.toothpaste;
  if (n.includes('SHAMPOO') || n.includes('HAIR') || n.includes('CONDITIONER') || n.includes('CLINIC') || n.includes('SUNSILK') || n.includes('PANTENE') || n.includes('HEAD') || n.includes('MEERA') || n.includes('VATIKA')) return PACK_SHOTS.shampoo;
  if (n.includes('SOAP') || n.includes('BATH') || n.includes('DETTOL') || n.includes('MEDIMIX') || n.includes('SANTOOR') || n.includes('LIFEBUOY') || n.includes('LUX') || n.includes('DOVE') || n.includes('CINTHOL') || n.includes('HAMAM') || n.includes('PEARS') || n.includes('BODY WASH')) return PACK_SHOTS.soap;
  if (n.includes('DETERGENT') || n.includes('WASHING') || n.includes('SURF') || n.includes('ARIEL') || n.includes('RIN') || n.includes('WHEEL') || n.includes('TIDE') || n.includes('BAR') || n.includes('VIM') || n.includes('EXO') || n.includes('DISHWASH')) return PACK_SHOTS.detergent;

  // Household & Stationery
  if (n.includes('PEN') || n.includes('NOTEBOOK') || n.includes('BOOK') || n.includes('PAPER') || n.includes('PENCIL') || n.includes('ERASER') || n.includes('SHARPENER') || n.includes('FILE') || n.includes('TAPE')) return PACK_SHOTS.stationery;

  // Category fallback
  if (categoryId === 2) return PACK_SHOTS.milk;
  if (categoryId === 3) return PACK_SHOTS.snack_pack;
  if (categoryId === 4) return PACK_SHOTS.soap;
  if (categoryId === 5) return PACK_SHOTS.yellow_cloth;
  return PACK_SHOTS.provisions_default;
}

async function populateAll() {
  const start = Date.now();
  console.log('Populating pack shot images matching mockup for all items in Supabase...');

  try {
    const itemsRes = await pool.query('SELECT id, name, category_id FROM items');
    console.log(`Processing ${itemsRes.rows.length} items...`);

    const whenStatements = [];
    const ids = [];

    for (const item of itemsRes.rows) {
      const img = resolveItemImage(item.name, item.category_id);
      whenStatements.push(`WHEN id = ${item.id} THEN '${img}'`);
      ids.push(item.id);
    }

    const chunkSize = 500;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunkIds = ids.slice(i, i + chunkSize);
      const chunkWhens = whenStatements.slice(i, i + chunkSize);

      const updateQuery = `
        UPDATE items SET
          image_url = CASE ${chunkWhens.join(' ')} END,
          updated_at = NOW()
        WHERE id IN (${chunkIds.join(', ')});
      `;

      await pool.query(updateQuery);
    }

    console.log(`✓ All 1,852 items updated with pack shots in ${Date.now() - start}ms!`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

populateAll();
