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
        Map.entry("PICKUP", "🚛"),
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

/** 默认循环间隔（月）；0 表示不循环。年检走自动推算（见 nextInspection）。 */
    public static int defaultRepeatMonths(String key) {
        if (key == null) {
            return 0;
        }
        return switch (key) {
            case "INSURANCE_COMPULSORY", "INSURANCE_COMMERCIAL", "TAX", "LICENSE" -> 12;
            case "INSPECTION" -> 12;
            default -> 0;
        };
    }

    /** 年检推算结果：日期 + 阶段 + 依据说明 + 是否需要人工确认（如电瓶车/自行车免年检）。 */
    public record InspectionNext(String date, String phase, String rule, boolean manualNeeded) {
    }

    /**
     * 按「首次登记日期 + 车辆分类」推算下一个年检节点（默认：非营运小微型载客汽车规则）：
     * 第 2、4 年 → 免检申领标志；第 6、10 年 → 上线检验；第 11 年起 → 每年上线检验。
     * 摩托车：前 4 年每 2 年申领，之后每年上线（各地可能不同，界面提示可手动覆盖）。
     * 电瓶车 / 自行车：免年检，返回 manualNeeded=true。
     */
    public static InspectionNext nextInspection(String registeredDate, String vehicleType, java.time.LocalDate today) {
        return nextInspection(registeredDate, vehicleType, today, DEFAULT_INSPECTION_NODES,
            DEFAULT_INSPECTION_YEARLY_FROM);
    }

    /** 默认年检节点（年）：第 2、4 年免检申领，第 6、10 年上线检验 */
    public static final java.util.List<Integer> DEFAULT_INSPECTION_NODES = java.util.List.of(2, 4, 6, 10);
    /** 默认从第 11 年起每年上线检验 */
    public static final int DEFAULT_INSPECTION_YEARLY_FROM = 11;

    /** 解析「年检节点」设置（形如 "2,4,6,10"）；非法或为空时回退默认 */
    public static java.util.List<Integer> parseInspectionNodes(String text) {
        if (text == null || text.isBlank()) {
            return DEFAULT_INSPECTION_NODES;
        }
        java.util.List<Integer> nodes = new java.util.ArrayList<>();
        for (String part : text.split("[,，\\s]+")) {
            if (part.isBlank()) {
                continue;
            }
            try {
                int year = Integer.parseInt(part.trim());
                if (year >= 1 && year <= 30 && !nodes.contains(year)) {
                    nodes.add(year);
                }
            } catch (NumberFormatException ignored) {
                // 忽略非法片段
            }
        }
        return nodes.isEmpty() ? DEFAULT_INSPECTION_NODES : nodes.stream().sorted().toList();
    }

    /**
     * 年检推算（规则可配置）：节点年 + 「从第 N 年起每年上线检验」。
     * 阶段判定：≥6 年（或 ≥ yearlyFrom）为上线检验，其余为免检申领；摩托车仍走内置规则。
     */
    public static InspectionNext nextInspection(String registeredDate, String vehicleType,
        java.time.LocalDate today, java.util.List<Integer> nodes, int yearlyFrom) {
        java.time.LocalDate base = null;
        if (registeredDate != null && !registeredDate.isBlank()) {
            try {
                base = java.time.LocalDate.parse(registeredDate.trim());
            } catch (Exception ignored) {
                base = null;
            }
        }
        String type = vehicleType == null ? "" : vehicleType;
        if ("EBIKE".equals(type) || "BICYCLE".equals(type)) {
            return new InspectionNext(null, "", "电瓶车 / 自行车通常无需年检，可按当地规定手动填写", true);
        }
        if (base == null) {
            return new InspectionNext(null, "", "缺少首次登记日期，无法自动推算，请手动填写", true);
        }
        boolean motorcycle = "MOTORCYCLE".equals(type);
        int yearly = yearlyFrom >= 1 && yearlyFrom <= 30 ? yearlyFrom : DEFAULT_INSPECTION_YEARLY_FROM;
        java.util.List<Integer> nodeYears = nodes == null || nodes.isEmpty() ? DEFAULT_INSPECTION_NODES : nodes;
        String nodeText = nodeYears.stream().map(String::valueOf).collect(java.util.stream.Collectors.joining("、"));
        String rule = motorcycle
            ? "按摩托车规则推算（前 4 年每 2 年申领免检标志，之后每年上线检验；以当地车管所为准）"
            : "按非营运小微型载客汽车规则推算（第 " + nodeText + " 年检验；第 " + yearly + " 年起每年上线检验；"
                + "可在「座驾设置 → 年检节点」中按当地规则调整）";

        java.time.LocalDate best = null;
        String bestPhase = "";
        for (int year = 2; year <= 30; year++) {
            boolean node;
            String phase;
            if (motorcycle) {
                node = year <= 4 ? year % 2 == 0 : true;
                phase = year <= 4 ? "免检申领" : "上线检验";
            } else {
                if (year >= yearly) {
                    // 从第 N 年起每年上线检验
                    node = true;
                    phase = "上线检验";
                } else if (nodeYears.contains(year)) {
                    // 配置的检验节点（默认第 2、4 年免检申领；第 6、10 年上线检验）
                    node = true;
                    phase = year >= 6 ? "上线检验" : "免检申领";
                } else {
                    node = false;
                    phase = "";
                }
            }
            if (!node) {
                continue;
            }
            java.time.LocalDate candidate = base.plusYears(year);
            if (!candidate.isBefore(today)) {
                best = candidate;
                bestPhase = phase;
                break;
            }
            best = candidate;
            bestPhase = phase;
        }
        if (best == null) {
            return new InspectionNext(null, "", "无法推算，请手动填写", true);
        }
        return new InspectionNext(best.toString(), bestPhase, rule, false);
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
