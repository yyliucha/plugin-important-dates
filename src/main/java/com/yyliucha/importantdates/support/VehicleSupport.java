package com.yyliucha.importantdates.support;

import java.util.Map;

/**
 * 座驾相关的映射与脱敏工具（1.2.0）。
 *
 * <p>覆盖汽车、电瓶车、自行车等「座驾」分类；提供分类中文名与图标、
 * 能源类型中文名、车牌号前台脱敏、按性别决定的卡片皮肤。
 *
 * @author yyliucha
 * @since 1.2.0
 */
public final class VehicleSupport {

    private VehicleSupport() {
    }

    /** 分类 → 中文名 */
    private static final Map<String, String> TYPE_LABELS = Map.ofEntries(
        Map.entry("SEDAN", "轿车"),
        Map.entry("SUV", "SUV"),
        Map.entry("MPV", "MPV"),
        Map.entry("SPORTS", "跑车"),
        Map.entry("ORV", "越野车"),
        Map.entry("PICKUP", "皮卡"),
        Map.entry("WAGON", "旅行车"),
        Map.entry("HATCHBACK", "两厢车"),
        Map.entry("CROSSOVER", "跨界车"),
        Map.entry("VAN", "微面/面包车"),
        Map.entry("RV", "房车"),
        Map.entry("TRUCK", "货车"),
        Map.entry("BUS", "客车"),
        Map.entry("MOTORCYCLE", "摩托车"),
        Map.entry("EBIKE", "电瓶车"),
        Map.entry("BICYCLE", "自行车"),
        Map.entry("OTHER", "其他")
    );

    /** 分类 → 图标 */
    private static final Map<String, String> TYPE_ICONS = Map.ofEntries(
        Map.entry("SEDAN", "🚗"),
        Map.entry("SUV", "🚙"),
        Map.entry("MPV", "🚐"),
        Map.entry("SPORTS", "🏎️"),
        Map.entry("ORV", "🚙"),
        Map.entry("PICKUP", "🛻"),
        Map.entry("WAGON", "🚗"),
        Map.entry("HATCHBACK", "🚗"),
        Map.entry("CROSSOVER", "🚙"),
        Map.entry("VAN", "🚐"),
        Map.entry("RV", "🚌"),
        Map.entry("TRUCK", "🚚"),
        Map.entry("BUS", "🚌"),
        Map.entry("MOTORCYCLE", "🏍️"),
        Map.entry("EBIKE", "🛵"),
        Map.entry("BICYCLE", "🚲"),
        Map.entry("OTHER", "🚘")
    );

    /** 能源类型 → 中文名 */
    private static final Map<String, String> ENERGY_LABELS = Map.of(
        "FUEL", "燃油",
        "EV", "纯电",
        "PHEV", "插电混动",
        "HEV", "油电混动",
        "HUMAN", "人力"
    );

    /** 到期项默认显示名（自定义项由用户填写 label） */
    private static final Map<String, String> REMINDER_LABELS = Map.of(
        "INSURANCE_COMPULSORY", "交强险",
        "INSURANCE_COMMERCIAL", "商业险",
        "INSPECTION", "年检",
        "MAINTENANCE", "保养",
        "TAX", "车船税",
        "LICENSE", "驾照换证"
    );

    /** 按年循环的到期项（到期后自动滚动到下一次） */
    private static final java.util.Set<String> YEARLY_KEYS = java.util.Set.of(
        "INSURANCE_COMPULSORY", "INSURANCE_COMMERCIAL", "INSPECTION", "TAX", "LICENSE"
    );

    public static String typeLabel(String type) {
        return TYPE_LABELS.getOrDefault(type == null ? "" : type, "其他");
    }

    public static String typeIcon(String type) {
        return TYPE_ICONS.getOrDefault(type == null ? "" : type, "🚘");
    }

    public static String energyLabel(String energy) {
        return ENERGY_LABELS.getOrDefault(energy == null ? "" : energy, "燃油");
    }

    public static String reminderLabel(String key, String customLabel) {
        if (customLabel != null && !customLabel.isBlank()) {
            return customLabel;
        }
        return REMINDER_LABELS.getOrDefault(key == null ? "" : key, "到期事项");
    }

    public static boolean isYearly(String key) {
        return key != null && YEARLY_KEYS.contains(key);
    }

    /**
     * 车牌号前台脱敏：保留归属地（省+字母）与末位，中间以 **** 代替。
     * 例：粤B12345 → 粤B·****5；沪AD12345（新能源）→ 沪A·****5；长度不足时降级处理。
     */
    public static String maskPlate(String plate) {
        if (plate == null || plate.isBlank()) {
            return "";
        }
        String raw = plate.replaceAll("\\s", "");
        if (raw.length() <= 2) {
            return "*".repeat(raw.length());
        }
        String prefix = raw.substring(0, 2);
        String suffix = raw.substring(raw.length() - 1);
        return prefix + "·****" + suffix;
    }

    /**
     * 卡片皮肤：男=酷、女=可爱、其他/未填=中性。
     */
    public static String skinOf(String gender) {
        if ("男".equals(gender) || "MALE".equalsIgnoreCase(gender)) {
            return "cool";
        }
        if ("女".equals(gender) || "FEMALE".equalsIgnoreCase(gender)) {
            return "cute";
        }
        return "neutral";
    }
}
