package run.halo.importantdates.vo;

import java.util.List;
import lombok.Data;

/**
 * 前台展示用重要日期视图对象。
 *
 * @author important-dates
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
}
