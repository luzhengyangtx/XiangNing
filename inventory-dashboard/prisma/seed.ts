import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaLibSql({
  url: "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // Create default users
  const adminPw = await bcrypt.hash("admin123", 10);
  const staffPw = await bcrypt.hash("staff123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@inventory.local" },
    update: {},
    create: {
      name: "店长",
      email: "admin@inventory.local",
      password: adminPw,
      role: "owner",
    },
  });

  const staff = await prisma.user.upsert({
    where: { email: "staff@inventory.local" },
    update: {},
    create: {
      name: "店员小李",
      email: "staff@inventory.local",
      password: staffPw,
      role: "staff",
    },
  });

  console.log("Users created:", admin.email, staff.email);

  // Create platforms
  const platforms = [
    {
      name: "美团闪购",
      code: "meituan",
      status: "connected",
      authType: "oauth",
      authData: JSON.stringify({ token: "mock_meituan_token", expiresAt: "2027-12-31" }),
      config: JSON.stringify({ priceRatio: 1.0, stockRatio: 1.0, stockMode: "shared" }),
    },
    {
      name: "饿了么零售",
      code: "eleme",
      status: "connected",
      authType: "oauth",
      authData: JSON.stringify({ token: "mock_eleme_token", expiresAt: "2027-06-30" }),
      config: JSON.stringify({ priceRatio: 1.05, stockRatio: 0.9, stockMode: "shared" }),
    },
    {
      name: "京东到家",
      code: "jddj",
      status: "disconnected",
      authType: "apikey",
      config: JSON.stringify({ priceRatio: 1.0, stockRatio: 1.0, stockMode: "shared" }),
    },
    {
      name: "抖音小时达",
      code: "douyin",
      status: "disconnected",
      authType: "oauth",
      config: JSON.stringify({ priceRatio: 1.0, stockRatio: 1.0, stockMode: "shared" }),
    },
  ];

  for (const p of platforms) {
    await prisma.platform.upsert({
      where: { code: p.code },
      update: p,
      create: p,
    });
  }
  console.log("Platforms created:", platforms.map((p) => p.name).join(", "));

  // Create sample products
  const products = [
    { name: "可口可乐 330ml 罐装", sku: "COKE-330", category: "饮料", price: 3.5, unit: "罐", currentStock: 45, safetyStock: 10 },
    { name: "农夫山泉 550ml", sku: "NFS-550", category: "饮料", price: 2.0, unit: "瓶", currentStock: 120, safetyStock: 20 },
    { name: "康师傅红烧牛肉面 110g", sku: "KSF-NOODLE-110", category: "方便食品", price: 4.5, unit: "袋", currentStock: 8, safetyStock: 15 },
    { name: "德芙丝滑牛奶巧克力 80g", sku: "DOVE-80", category: "零食", price: 15.9, unit: "盒", currentStock: 32, safetyStock: 5 },
    { name: "维达抽纸 3层 120抽×3包", sku: "VIDA-TISSUE-3P", category: "日用品", price: 12.9, unit: "提", currentStock: 15, safetyStock: 10 },
    { name: "三只松鼠坚果大礼包 750g", sku: "SZS-750", category: "零食", price: 89.0, unit: "盒", currentStock: 3, safetyStock: 10 },
    { name: "海飞丝去屑洗发水 400ml", sku: "HFS-400", category: "日用品", price: 49.9, unit: "瓶", currentStock: 25, safetyStock: 8 },
    { name: "百威啤酒 330ml×6罐", sku: "BUD-330-6", category: "酒类", price: 29.9, unit: "提", currentStock: 60, safetyStock: 12 },
    { name: "乐事薯片 原味 75g", sku: "LAYS-ORIG-75", category: "零食", price: 8.9, unit: "袋", currentStock: 50, safetyStock: 15 },
    { name: "蒙牛纯牛奶 250ml×12盒", sku: "MENGNIU-250-12", category: "乳制品", price: 55.0, unit: "箱", currentStock: 18, safetyStock: 15 },
  ];

  for (const prod of products) {
    await prisma.product.upsert({
      where: { sku: prod.sku },
      update: prod,
      create: prod,
    });
  }
  console.log(`Products created: ${products.length}`);

  // Create platform-product links for connected platforms
  const allProducts = await prisma.product.findMany();
  const meituan = await prisma.platform.findUnique({ where: { code: "meituan" } });
  const eleme = await prisma.platform.findUnique({ where: { code: "eleme" } });

  if (meituan) {
    for (const p of allProducts) {
      await prisma.productPlatformLink.upsert({
        where: { productId_platformId: { productId: p.id, platformId: meituan.id } },
        update: {},
        create: {
          productId: p.id,
          platformId: meituan.id,
          platformSku: `MT_${p.sku}`,
          syncStatus: "synced",
          lastSyncAt: new Date(),
        },
      });
    }
  }

  if (eleme) {
    for (const p of allProducts) {
      await prisma.productPlatformLink.upsert({
        where: { productId_platformId: { productId: p.id, platformId: eleme.id } },
        update: {},
        create: {
          productId: p.id,
          platformId: eleme.id,
          platformSku: `ELM_${p.sku}`,
          syncStatus: "synced",
          lastSyncAt: new Date(),
        },
      });
    }
  }
  console.log("Platform-product links created.");

  // Create a sample sync task with failed items
  const sampleTask = await prisma.syncTask.create({
    data: {
      platformId: meituan!.id,
      type: "push_inventory",
      status: "partial_fail",
      totalCount: 10,
      failCount: 2,
      startedAt: new Date(Date.now() - 600000),
      finishedAt: new Date(Date.now() - 590000),
      items: {
        create: [
          {
            productId: allProducts[3].id, // 德芙巧克力
            status: "failed",
            errorCode: "IMG_LINK_INVALID",
            errorMessage: "商品主图链接失效，请重新上传",
          },
          {
            productId: allProducts[7].id, // 百威啤酒
            status: "failed",
            errorCode: "SKU_DUPLICATE",
            errorMessage: "SKU已存在于美团平台，请检查商品映射",
          },
        ],
      },
    },
  });
  console.log("Sample sync task created:", sampleTask.id);

  // Create operation logs
  await prisma.operationLog.createMany({
    data: [
      { userId: admin.id, action: "stock_in", entityType: "product", entityId: allProducts[0].id, detail: JSON.stringify({ delta: 20, reason: "进货入库", from: 25, to: 45 }) },
      { userId: admin.id, action: "stock_out", entityType: "product", entityId: allProducts[2].id, detail: JSON.stringify({ delta: -3, reason: "美团订单 #20260429001 自动扣减", from: 11, to: 8 }) },
      { userId: admin.id, action: "platform_bind", entityType: "platform", entityId: meituan!.id, detail: JSON.stringify({ platform: "美团闪购", authType: "oauth" }) },
      { userId: staff.id, action: "create_product", entityType: "product", entityId: allProducts[9].id, detail: JSON.stringify({ name: "蒙牛纯牛奶 250ml×12盒" }) },
      { userId: admin.id, action: "sync_push", entityType: "sync_task", entityId: sampleTask.id, detail: JSON.stringify({ type: "push_inventory", platform: "美团闪购", result: "partial_fail", failCount: 2 }) },
    ],
  });
  console.log("Operation logs created.");

  console.log("\nSeed completed successfully.");
  console.log("Login credentials:");
  console.log("  店长: admin@inventory.local / admin123");
  console.log("  店员: staff@inventory.local / staff123");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
