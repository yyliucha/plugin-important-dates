package run.halo.importantdates;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.EqualsAndHashCode;
import run.halo.app.extension.AbstractExtension;
import run.halo.app.extension.GVK;

/**
 * 重要日期自定义模型。
 *
 * <p>用于在后台记录"结婚纪念日"、"孩子出生日期"等重要日子，支持阳历/农历两种日期类型，
 * 每年按记录自动循环。生成用于存储的扩展资源：{@code importantdates.halo.run/v1alpha1}。
 *
 * @author important-dates
 * @since 1.0.0
 */
@Data
@EqualsAndHashCode(callSuper = true)
@GVK(group = "importantdates.halo.run", version = "v1alpha1", kind = "ImportantDate",
    plural = "importantdates", singular = "importantdate")
public class ImportantDate extends AbstractExtension {

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    private ImportantDateSpec spec;

    /**
     * 重要日期字段。
     */
    @Data
    @Schema(description = "重要日期规格")
    public static class ImportantDateSpec {

        /**
         * 名称，例如：结婚纪念日、孩子出生日期。
         */
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "重要日期名称")
        private String title;

        /**
         * 日期类型：SOLAR（阳历）或 LUNAR（农历）。
         */
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "日期类型")
        private String dateType = "SOLAR";

        /**
         * 阳历日期，格式 yyyy-MM-dd，dateType 为 SOLAR 时必填。
         */
        @Schema(description = "阳历日期（yyyy-MM-dd）")
        private String solarDate;

        /**
         * 农历月（1-12），dateType 为 LUNAR 时必填。
         */
        @Schema(description = "农历月")
        private Integer lunarMonth;

        /**
         * 农历日（1-30），dateType 为 LUNAR 时必填。
         */
        @Schema(description = "农历日")
        private Integer lunarDay;

        /**
         * 是否闰月（仅农历类型有效）。
         */
        @Schema(description = "是否闰月")
        private Boolean isLeapMonth = false;

        /**
         * 备注信息，多行纯文本。
         */
        @Schema(description = "备注信息")
        private String note;

        /**
         * 关联的人员（Person metadata.name 列表），可关联多人。
         */
        @Schema(description = "关联的人员")
        private java.util.List<String> personNames;

        /**
         * 是否重要（用于全站到期提醒等场景）。默认 true。
         */
        @Schema(description = "是否重要")
        private Boolean important = true;

        /**
         * 是否在前台展示。默认 true；false 表示仅后台可见。
         */
        @Schema(description = "是否在前台展示")
        private Boolean visible = true;
    }
}
