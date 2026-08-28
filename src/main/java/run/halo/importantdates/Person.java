package run.halo.importantdates;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.EqualsAndHashCode;
import run.halo.app.extension.AbstractExtension;
import run.halo.app.extension.GVK;

/**
 * 人员自定义模型。
 *
 * <p>记录一个人的基础信息（姓名、关系、生日、性别、血型、身高、体重、喜好等），
 * 重要日期记录可通过 {@code spec.personNames} 关联到人员。
 *
 * @author important-dates
 * @since 1.0.4
 */
@Data
@EqualsAndHashCode(callSuper = true)
@GVK(group = "importantdates.halo.run", version = "v1alpha1", kind = "Person",
    plural = "persons", singular = "person")
public class Person extends AbstractExtension {

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    private PersonSpec spec;

    /**
     * 人员字段。
     */
    @Data
    @Schema(description = "人员规格")
    public static class PersonSpec {

        /**
         * 姓名，例如：张三。
         */
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "姓名")
        private String displayName;

        /**
         * 昵称/称呼。
         */
        @Schema(description = "昵称/称呼")
        private String nickname;

        /**
         * 关系，例如：配偶/子女/父母/朋友。
         */
        @Schema(description = "关系")
        private String relation;

        /**
         * 生日日期类型：SOLAR（阳历）或 LUNAR（农历）。
         */
        @Schema(description = "生日日期类型")
        private String dateType = "SOLAR";

        /**
         * 阳历生日 yyyy-MM-dd。
         */
        @Schema(description = "阳历生日")
        private String solarDate;

        /**
         * 农历生日月（1-12）。
         */
        @Schema(description = "农历生日月")
        private Integer lunarMonth;

        /**
         * 农历生日日（1-30）。
         */
        @Schema(description = "农历生日日")
        private Integer lunarDay;

        /**
         * 农历生日是否闰月。
         */
        @Schema(description = "农历生日是否闰月")
        private Boolean isLeapMonth = false;

        /**
         * 性别。
         */
        @Schema(description = "性别")
        private String gender;

        /**
         * 血型。
         */
        @Schema(description = "血型")
        private String bloodType;

        /**
         * 身高（cm）。
         */
        @Schema(description = "身高(cm)")
        private Double heightCm;

        /**
         * 体重（kg），记录最新值。
         */
        @Schema(description = "体重(kg)")
        private Double weightKg;

        /**
         * 喜好/兴趣。
         */
        @Schema(description = "喜好/兴趣")
        private String hobbies;

        /**
         * 备注。
         */
        @Schema(description = "备注")
        private String note;

        /**
         * 是否在前台展示。默认 true；false 表示仅后台可见。
         */
        @Schema(description = "是否在前台展示")
        private Boolean visible = true;
    }
}
