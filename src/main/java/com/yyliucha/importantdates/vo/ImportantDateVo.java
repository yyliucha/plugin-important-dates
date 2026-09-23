package com.yyliucha.importantdates.vo;

import java.util.List;
import lombok.Data;

/**
 * 前台展示用重要日期视图对象。
 *
 * @author yyliucha
 * @since 1.0.5
 */
@Data
public class ImportantDateVo {

    /**
     * 记录标识。
     */
    private String name;

    /**
     * 名称。
     */
    private String title;

    /**
     * 日期类型：SOLAR / LUNAR。
     */
    private String dateType;

    /**
     * 日期显示文本（阳历 "2025-05-20" 或农历 "六月初六"）。
     */
    private String dateText;

    /**
     * 下一次出现的阳历日期（yyyy-MM-dd）。
     */
    private String nextSolarDate;

    /**
     * 距下一次出现的天数（>= 0）。
     */
    private long daysUntil;

    /**
     * 关联人员姓名（显示用，不含隐私字段）。
     */
    private List<String> personNames;

    /**
     * 是否重要。
     */
    private boolean important;

    /**
     * 前台是否可见。
     */
    private boolean frontendVisible;

    /**
     * 剩余天数是否有效（nextSolarDate 非空即有效）。
     */
    private boolean daysValid;

    /**
     * 排序权重（拖拽排序；越小越靠前）。
     */
    private int sortOrder;

    /**
     * 创建时间（排序平级时的次级排序依据）。
     */
    private String createdAt;

    /**
     * 当前阶段编码（D3/D1/D0；不在节点日为空）——节点式提醒，1.2.6。
     */
    private String stageCode;

    /**
     * 该阶段的节点是否已经提醒过（写库，跨浏览器/设备一致）。
     */
    private boolean stageNotified;

    /**
     * 阶段文案（人性化，逐日不同）。
     */
    private String stageText;
}
