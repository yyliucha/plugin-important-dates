package com.yyliucha.importantdates.support;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

/**
 * 到期提醒的状态机与文案（「记得」1.2.6）。
 *
 * <p><b>设计原则</b>：插件只做单一的事，一切状态变化都以用户指令为准 ——
 * 不做自动顺延、不猜测"办没办"。到期日只决定"现在处于哪个阶段"，
 * 真正的状态（已办 / 已忽略）由用户点击写入数据。
 *
 * <p><b>阶段（节点式）</b>：进入提醒期后按关键节点提醒，每个节点只主动弹一次
 * （{@code D15} / {@code D7} / {@code D3} / {@code D1} / {@code D0}，逾期后 {@code O1}、{@code O2}…），
 * 节点记录写库，关浏览器/换设备都不会重置。
 *
 * <p><b>逾期</b>：逾期后仍会提醒（默认 3 天，可配），超过窗口转入「待处理」：
 * 不再主动提醒，但**永远保留在列表里**直到用户「已办」或「忽略」。
 *
 * @author yyliucha
 * @since 1.2.6
 */
public final class ReminderSupport {

    private ReminderSupport() {
    }

    /** 状态：待办（未到期或已逾期但仍在提醒窗口内） */
    public static final String STATUS_PENDING = "PENDING";
    /** 状态：待处理（逾期已超过窗口，不再主动提醒，但保留在列表） */
    public static final String STATUS_TODO = "TODO";
    /** 状态：已办 */
    public static final String STATUS_DONE = "DONE";
    /** 状态：已忽略（本周期） */
    public static final String STATUS_SKIPPED = "SKIPPED";

    /** 提前期固定节点（天） */
    private static final int[] BASE_NODES = {15, 7, 3, 1, 0};

    /** 逾期后继续主动提醒的默认天数（设置「提醒设置 → 逾期后继续提醒天数」） */
    public static final int DEFAULT_OVERDUE_DAYS = 3;

    /** 逾期提醒天数上下限 */
    public static int clampOverdueDays(int value) {
        if (value < 1) {
            return 1;
        }
        return Math.min(value, 30);
    }

    /**
     * 计算"生效的办理状态"：忽略只针对当时那个到期日，日期一变（进入下一期）自动恢复待办。
     */
    public static String effectiveAck(String ackState, String skippedForDate, String resolvedDate) {
        String state = ackState == null || ackState.isBlank() ? STATUS_PENDING : ackState;
        if (STATUS_SKIPPED.equals(state) && skippedForDate != null && !skippedForDate.isBlank()
            && !skippedForDate.equals(resolvedDate)) {
            return STATUS_PENDING;
        }
        return state;
    }

    /**
     * 提前期节点列表：按该项的提前提醒天数裁剪（例如提前 30 天 → 30/15/7/3/1/0；提前 5 天 → 5/3/1/0）。
     */
    public static java.util.List<Integer> advanceNodes(int remindDays) {
        java.util.LinkedHashSet<Integer> nodes = new java.util.LinkedHashSet<>();
        int window = Math.max(0, remindDays);
        nodes.add(window);
        // 节奏 B：窗口内每 7 天一个节点（从窗口起点往下），进入最后 15 天后按 15/7/3/1/0 加密
        for (int d = window - 7; d > 15; d -= 7) {
            nodes.add(d);
        }
        for (int n : BASE_NODES) {
            if (n <= window) {
                nodes.add(n);
            }
        }
        java.util.List<Integer> sorted = new java.util.ArrayList<>(nodes);
        sorted.sort((a, b) -> Integer.compare(b, a));
        return sorted;
    }

    /**
     * 当前阶段编码；不在任何节点上时返回 null（说明今天不是"该弹"的日子，列表里照常显示）。
     *
     * @param daysUntil     距到期天数（负数表示已逾期）
     * @param remindDays    该项提前提醒天数
     * @param overdueDays   逾期后继续主动提醒的天数（设置项，默认 3）
     */
    public static String stageCode(long daysUntil, int remindDays, int overdueDays) {
        if (daysUntil >= 0) {
            return advanceNodes(remindDays).contains((int) daysUntil) ? "D" + daysUntil : null;
        }
        long overdue = -daysUntil;
        return overdue <= Math.max(0, overdueDays) ? "O" + overdue : null;
    }

    /** 是否属于「待处理」：逾期超过窗口 */
    public static boolean isTodo(long daysUntil, int overdueDays) {
        return daysUntil < 0 && -daysUntil > Math.max(0, overdueDays);
    }

    /** 计算状态：已办/已忽略优先，其次是待处理，其余为待办 */
    public static String status(String ackState, long daysUntil, int overdueDays) {
        if ("DONE".equals(ackState)) {
            return STATUS_DONE;
        }
        if ("SKIPPED".equals(ackState)) {
            return STATUS_SKIPPED;
        }
        return isTodo(daysUntil, overdueDays) ? STATUS_TODO : STATUS_PENDING;
    }

    /**
     * 阶段文案 —— 逐日不同、贴近日常说话习惯（需求确认于 1.2.6 设计沟通）。
     *
     * @param who   车辆名（如"小白"）；为空时输出通用句
     * @param label 项目名（如"交强险"）
     */
    public static String stageText(String who, String label, long daysUntil, int overdueDays) {
        String name = (who == null || who.isBlank()) ? "" : who;
        String item = (label == null || label.isBlank()) ? "这项" : label;
        String prefix = name.isEmpty() ? "「" + item + "」" : "「" + name + "」的" + item;
        if (daysUntil > 1) {
            if (daysUntil == 15) {
                return prefix + "还有半个月到期，可以先安排一下";
            }
            if (daysUntil == 7) {
                return prefix + "还剩一周，记得抽空办";
            }
            if (daysUntil == 3) {
                return prefix + "还有 3 天就到期了";
            }
            return prefix + "还有 " + daysUntil + " 天到期";
        }
        if (daysUntil == 1) {
            return prefix + "明天到期";
        }
        if (daysUntil == 0) {
            return prefix + "就是今天到期，别忘了处理哦";
        }
        long overdue = -daysUntil;
        if (overdue == 1) {
            return prefix + "昨天到期了，记得安排一下~";
        }
        if (overdue == 2) {
            return prefix + "已经逾期 2 天，别忘了办呀";
        }
        if (overdue == 3) {
            return prefix + "逾期 3 天了，尽快抽空处理吧（这是最后一次主动提醒，之后可在后台查看）";
        }
        if (overdue <= Math.max(0, overdueDays)) {
            return prefix + "已逾期 " + overdue + " 天，尽快抽空处理吧";
        }
        return prefix + "已逾期 " + overdue + " 天 · 待处理";
    }

    /**
     * 纪念日 / 生日的阶段文案：保持插件原有措辞（温暖口吻，不随版本改变）。
     */
    public static String dateStageText(String title, long daysUntil) {
        String name = title == null || title.isBlank() ? "这一天" : title;
        if (daysUntil <= 0) {
            return "「" + name + "」就是今天呀 🎉";
        }
        if (daysUntil == 1) {
            return "「" + name + "」明天就到啦～";
        }
        return "「" + name + "」还有 " + daysUntil + " 天就到啦～";
    }

    /** 已办 / 已忽略的状态说明（后台列表展示用） */
    public static String stateText(String status, String lastDoneAt, String lastDoneFrom, long overdueDays) {
        if (STATUS_DONE.equals(status)) {
            String when = lastDoneAt == null ? "" : lastDoneAt.replace('T', ' ').substring(0, Math.min(16, lastDoneAt.length()));
            String from = (lastDoneFrom == null || lastDoneFrom.isBlank()) ? "" : "（原到期日 " + lastDoneFrom + "）";
            return when.isEmpty() ? "已办" : "已办 · " + when + from;
        }
        if (STATUS_SKIPPED.equals(status)) {
            return "本周期已忽略";
        }
        if (STATUS_TODO.equals(status)) {
            return "已逾期 " + overdueDays + " 天 · 待处理";
        }
        return "";
    }
}
