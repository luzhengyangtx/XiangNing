import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaLibSql({ url: "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  // ── Users ──
  const adminPw = await bcrypt.hash("admin123", 10);
  const staffPw = await bcrypt.hash("staff123", 10);

  const admin = await prisma.user.create({
    data: { name: "店长", email: "admin@inventory.local", password: adminPw, role: "owner" },
  });
  await prisma.user.create({
    data: { name: "店员小李", email: "staff@inventory.local", password: staffPw, role: "staff" },
  });
  console.log("Users created.");

  // ── Warehouses ──
  const whGuomao = await prisma.warehouse.create({
    data: { name: "国贸", code: "guomao", address: "北京市朝阳区国贸", isUnattendedMode: true },
  });
  const whHaidian = await prisma.warehouse.create({
    data: { name: "海淀", code: "haidian", address: "北京市海淀区" },
  });
  const whXierqi = await prisma.warehouse.create({
    data: { name: "西二旗", code: "xierqi", address: "北京市海淀区西二旗" },
  });
  console.log("Warehouses created: 国贸, 海淀, 西二旗");

  // ── Products from Excel ──
  const productData = [
    {
      sku: "113H001",
      title: "【火影忍者】手办公仔花束送男友老公新意好礼38女神节礼物走心的创意生日礼物1套",
      onlineSpec: "1束",
      beijingId: "BJ01001",
      originalPrice: 239,
      discountPrice: 188,
      costPrice: 99,
      weight: 500,
      categoryL1: "玩偶花束手办花束",
      categoryL2: "大号手办花束",
      link: "https://detail.1688.com/offer/633293529811.html",
      purchaseSpec: "带花：火影忍者花束+透明礼盒",
      jdSku: "2212558663",
      packagingMaterial: "自带蛋糕盒+自带灯串（两米）+丝带+自带手提袋",
      packagingPrice: 0,
      unit: "束",
      safetyStock: 2,
      mainImage: "/uploads/fire_ninja.jpg",
      warehouses: [
        { wh: whGuomao, stock: 1, unattended: 1, shelf: "T201-3", damaged: 0 },
        { wh: whXierqi, stock: 1, unattended: 1, shelf: "T202-3", damaged: 0 },
      ],
    },
    {
      sku: "113H057",
      title: "【樱桃小丸子】卡通公仔娃娃花束新意好礼38女神节礼物生日礼物表白女生仪式感礼盒1套",
      onlineSpec: "1束",
      beijingId: "BJ01002",
      originalPrice: 199,
      discountPrice: 150,
      costPrice: 55,
      weight: 300,
      categoryL1: "玩偶花束手办花束",
      categoryL2: "小号手办花束",
      link: "https://detail.1688.com/offer/613862138065.html",
      purchaseSpec: "樱桃小丸子+小透明礼盒+灯+袋",
      jdSku: "2212569973",
      packagingMaterial: "自带蛋糕盒+自带灯串+丝带+自带手提袋",
      packagingPrice: 0,
      unit: "束",
      safetyStock: 5,
      mainImage: "/uploads/cherry_maruko.jpg",
      warehouses: [
        { wh: whGuomao, stock: 3, unattended: 3, shelf: "T201-1", damaged: 0 },
        { wh: whXierqi, stock: 3, unattended: 3, shelf: "T202-3", damaged: 0 },
      ],
    },
    {
      sku: "113HC001",
      title: "【库洛米】长毛立体版女生创意玩偶花束新意好礼38女神节礼物送闺蜜儿童生日礼物1束",
      onlineSpec: "1束",
      beijingId: "BJ01003",
      originalPrice: 128,
      discountPrice: 89,
      costPrice: 40,
      weight: 300,
      categoryL1: "玩偶花束手办花束",
      categoryL2: "小号玩偶花束",
      link: "https://detail.1688.com/offer/750611799000.html",
      purchaseSpec: "黑色库洛米+礼袋+灯串+贺卡",
      jdSku: "2234921951",
      packagingMaterial: "自带手提袋（粉纸小）+自带灯串（一米）",
      packagingPrice: 0,
      unit: "束",
      safetyStock: 4,
      mainImage: "/uploads/kuromi.jpg",
      warehouses: [
        { wh: whGuomao, stock: 6, unattended: 4, shelf: "T102-3", damaged: 0 },
        { wh: whXierqi, stock: 4, unattended: 4, shelf: "T303-1", damaged: 0 },
      ],
    },
    {
      sku: "113HC002",
      title: "【卡比公主】长毛立体款玩偶花束生日礼物送女生38女神节礼物创意新意好礼花束1束",
      onlineSpec: "1束",
      beijingId: "BJ01004",
      originalPrice: 128,
      discountPrice: 89,
      costPrice: 40,
      weight: 300,
      categoryL1: "玩偶花束手办花束",
      categoryL2: "小号玩偶花束",
      link: "https://detail.1688.com/offer/750611799000.html",
      purchaseSpec: "卡比公主+礼袋+灯串+贺卡",
      jdSku: "2234924038",
      packagingMaterial: "自带手提袋（粉纸小）+自带灯串（一米）",
      packagingPrice: 0,
      unit: "束",
      safetyStock: 4,
      mainImage: "/uploads/kabi.jpg",
      warehouses: [
        { wh: whGuomao, stock: 6, unattended: 4, shelf: "T102-3", damaged: 0 },
        { wh: whXierqi, stock: 5, unattended: 5, shelf: "T303-1", damaged: 0 },
      ],
    },
    {
      sku: "113HC003",
      title: "【小海狸露比】长毛立体款玩偶花束38女神节礼物生日礼物送女生儿童新意好礼花束1束",
      onlineSpec: "1束",
      beijingId: "BJ01005",
      originalPrice: 128,
      discountPrice: 89,
      costPrice: 40,
      weight: 300,
      categoryL1: "玩偶花束手办花束",
      categoryL2: "小号玩偶花束",
      link: "https://detail.1688.com/offer/750611799000.html",
      purchaseSpec: "海狸+礼袋+灯串+贺卡",
      jdSku: "2234925385",
      packagingMaterial: "自带手提袋（粉纸小）+自带灯串（一米）",
      packagingPrice: 0,
      unit: "束",
      safetyStock: 4,
      mainImage: "/uploads/loopy.jpg",
      warehouses: [
        { wh: whGuomao, stock: 4, unattended: 4, shelf: "T102-3", damaged: 0 },
        { wh: whXierqi, stock: 3, unattended: 3, shelf: "T303-1", damaged: 0 },
      ],
    },
  ];

  for (const pd of productData) {
    const { warehouses, ...prodFields } = pd;
    const totalStock = warehouses.reduce((s, w) => s + w.stock, 0);

    await prisma.product.create({
      data: {
        ...prodFields,
        warehouseStocks: {
          create: warehouses.map((w) => ({
            warehouseId: w.wh.id,
            stock: w.stock,
            unattendedStock: w.unattended,
            shelfId: w.shelf,
            damagedStock: w.damaged,
          })),
        },
      },
    });
  }
  console.log(`Products created: ${productData.length}`);

  // ── Platforms ──
  const platforms = [
    { name: "美团闪购", code: "meituan", status: "connected", authType: "oauth", authData: JSON.stringify({ token: "mock_meituan_token", expiresAt: "2027-12-31" }), config: JSON.stringify({ priceRatio: 1.0, stockRatio: 1.0 }) },
    { name: "饿了么零售", code: "eleme", status: "connected", authType: "oauth", authData: JSON.stringify({ token: "mock_eleme_token", expiresAt: "2027-06-30" }), config: JSON.stringify({ priceRatio: 1.05, stockRatio: 0.9 }) },
    { name: "京东到家", code: "jddj", status: "disconnected", authType: "apikey", config: JSON.stringify({ priceRatio: 1.0, stockRatio: 1.0 }) },
    { name: "抖音小时达", code: "douyin", status: "disconnected", authType: "oauth", config: JSON.stringify({ priceRatio: 1.0, stockRatio: 1.0 }) },
  ];
  for (const p of platforms) {
    await prisma.platform.create({ data: p });
  }
  console.log("Platforms created.");

  // ── Platform links for 美团 and 饿了么 ──
  const allProducts = await prisma.product.findMany();
  const meituan = await prisma.platform.findUnique({ where: { code: "meituan" } });
  const eleme = await prisma.platform.findUnique({ where: { code: "eleme" } });
  if (meituan) {
    for (const p of allProducts) {
      await prisma.productPlatformLink.create({
        data: { productId: p.id, platformId: meituan.id, platformSku: `MT_${p.sku}`, syncStatus: "synced", shelvesStatus: "on", lastSyncAt: new Date() },
      });
    }
  }
  if (eleme) {
    for (const p of allProducts) {
      await prisma.productPlatformLink.create({
        data: { productId: p.id, platformId: eleme.id, platformSku: `ELM_${p.sku}`, syncStatus: "synced", shelvesStatus: "off", lastSyncAt: new Date() },
      });
    }
  }
  console.log("Platform-product links created.");

  // ── Sample sync task ──
  const sampleTask = await prisma.syncTask.create({
    data: {
      platformId: meituan!.id,
      type: "push_inventory",
      status: "partial_fail",
      totalCount: 5,
      failCount: 1,
      startedAt: new Date(Date.now() - 600000),
      finishedAt: new Date(Date.now() - 590000),
      items: {
        create: [
          { productId: allProducts[2].id, status: "failed", errorCode: "IMG_LINK_INVALID", errorMessage: "商品主图链接失效，请重新上传" },
        ],
      },
    },
  });

  // ── Operation logs ──
  await prisma.operationLog.createMany({
    data: [
      { userId: admin.id, action: "stock_in", entityType: "product", entityId: allProducts[0].id, detail: JSON.stringify({ delta: 1, reason: "进货入库", productName: "火影忍者手办花束", from: 1, to: 2 }) },
      { userId: admin.id, action: "platform_bind", entityType: "platform", entityId: meituan!.id, detail: JSON.stringify({ platform: "美团闪购", authType: "oauth" }) },
      { userId: admin.id, action: "sync_push", entityType: "sync_task", entityId: sampleTask.id, detail: JSON.stringify({ type: "push_inventory", platform: "美团闪购", result: "partial_fail", failCount: 1 }) },
    ],
  });
  console.log("Operation logs created.");

  // ── Sample Purchase Order ──
  const samplePO = await prisma.purchaseOrder.create({
    data: {
      warehouseId: whGuomao.id,
      status: "pending",
      note: "情人节前补货",
      items: {
        create: [
          { productId: allProducts[0].id, sku: allProducts[0].sku, quantity: 10, costPrice: allProducts[0].costPrice, link: allProducts[0].link },
          { productId: allProducts[3].id, sku: allProducts[3].sku, quantity: 5, costPrice: allProducts[3].costPrice, link: allProducts[3].link },
        ],
      },
    },
  });
  console.log("Sample purchase order created:", samplePO.id);

  console.log("\n✅ Seed completed.");
  console.log("   店长: admin@inventory.local / admin123");
  console.log("   店员: staff@inventory.local / staff123");
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
