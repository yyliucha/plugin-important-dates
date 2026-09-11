package com.yyliucha.importantdates;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.ArrayList;
import java.util.List;
import lombok.Data;
import lombok.EqualsAndHashCode;
import run.halo.app.extension.AbstractExtension;
import run.halo.app.extension.GVK;

/**
 * 汽车信息自定义模型（「记得」1.2.0）。
 *
 * <p>记录一辆车的档案、相册与到期事项（保险/年检/保养/车船税/自定义）。
 * 隐私约定：车牌号、VIN、发动机号、保单号、购买价格等敏感字段**永不输出到前台**；
 * 相册中的照片可逐张勾选「前台展示」。
 *
 * @author yyliucha
 * @since 1.2.0
 */
@Data
@EqualsAndHashCode(callSuper = true)
@GVK(group = "importantdates.halo.run", version = "v1alpha1", kind = "Car",
    plural = "cars", singular = "car")
public class Car extends AbstractExtension {

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    private CarSpec spec;

    /**
     * 车辆字段。
     */
    @Data
    @Schema(description = "车辆规格")
    public static class CarSpec {

        /**
         * 名称/昵称，例如：小白。
         */
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "名称/昵称")
        private String displayName;

        /**
         * 品牌，例如：比亚迪。
         */
        @Schema(description = "品牌")
        private String brand;

        /**
         * 车系型号，例如：汉 EV 2024 款。
         */
        @Schema(description = "车系型号")
        private String model;

        /**
         * 车牌号（敏感：前台永远脱敏显示）。
         */
        @Schema(description = "车牌号（敏感）")
        private String plateNo;

        /**
         * 车辆分类：SEDAN/SUV/MPV/SPORTS/ORV/PICKUP/WAGON/HATCHBACK/CROSSOVER/VAN/RV/TRUCK/BUS/MOTORCYCLE/EBIKE/BICYCLE/OTHER。
         */
        @Schema(description = "车辆分类")
        private String vehicleType = "SEDAN";

        /**
         * 能源类型：FUEL（燃油）/EV（纯电）/PHEV（插混）/HEV（油电混动）/HUMAN（人力，自行车）。
         */
        @Schema(description = "能源类型")
        private String energyType = "FUEL";

        /**
         * 颜色。
         */
        @Schema(description = "颜色")
        private String color;

        /**
         * 车架号 VIN（敏感）。
         */
        @Schema(description = "车架号（敏感）")
        private String vin;

        /**
         * 发动机号（敏感）。
         */
        @Schema(description = "发动机号（敏感）")
        private String engineNo;

        /**
         * 注册日期 yyyy-MM-dd。
         */
        @Schema(description = "注册日期")
        private String registeredDate;

        /**
         * 购买日期 yyyy-MM-dd。
         */
        @Schema(description = "购买日期")
        private String purchaseDate;

        /**
         * 购买价格（敏感：仅后台）。
         */
        @Schema(description = "购买价格（敏感）")
        private Double purchasePrice;

        /**
         * 当前里程（km）。
         */
        @Schema(description = "当前里程(km)")
        private Integer mileageKm;

        /**
         * 里程更新日期 yyyy-MM-dd。
         */
        @Schema(description = "里程更新日期")
        private String mileageUpdatedAt;

        /**
         * 状态：IN_USE（在用车）/ SOLD（已出售）/ SCRAPPED（已报废）。
         */
        @Schema(description = "状态")
        private String status = "IN_USE";

        /**
         * 相册照片（多张，首图默认为封面）。
         */
        @Schema(description = "相册照片")
        private List<Photo> photos = new ArrayList<>();

        /**
         * 车主（Person metadata.name，可空）。
         */
        @Schema(description = "车主")
        private String ownerName;

        /**
         * 常用驾驶人（Person metadata.name 列表，可空）。
         */
        @Schema(description = "常用驾驶人")
        private List<String> driverNames = new ArrayList<>();

        /**
         * 备注。
         */
        @Schema(description = "备注")
        private String note;

        /**
         * 前台是否展示（默认 false，隐私优先）。
         */
        @Schema(description = "是否在前台展示")
        private Boolean visible = false;

        /**
         * 是否参与提醒（默认 true）。
         */
        @Schema(description = "是否参与提醒")
        private Boolean important = true;

        /**
         * 排序权重（拖拽排序）。
         */
        @Schema(description = "排序权重")
        private Integer sortOrder = 0;

        /**
         * 到期提醒项。
         */
        @Schema(description = "到期提醒项")
        private List<Reminder> reminders = new ArrayList<>();
    }

    /**
     * 相册照片。
     */
    @Data
    @Schema(description = "相册照片")
    public static class Photo {

        /**
         * 图片地址（附件库 permalink）。
         */
        @Schema(description = "图片地址")
        private String url;

        /**
         * 显示名称（默认取附件名）。
         */
        @Schema(description = "显示名称")
        private String name;

        /**
         * 是否为封面。
         */
        @Schema(description = "是否封面")
        private Boolean isCover = false;

        /**
         * 排序权重。
         */
        @Schema(description = "排序权重")
        private Integer sortOrder = 0;

        /**
         * 是否在前台展示（默认 true；取消勾选则仅后台可见，适合证件类照片）。
         */
        @Schema(description = "是否在前台展示")
        private Boolean frontVisible = true;
    }

    /**
     * 到期提醒项。
     */
    @Data
    @Schema(description = "到期提醒项")
    public static class Reminder {

        /**
         * 项目标识：INSURANCE_COMPULSORY / INSURANCE_COMMERCIAL / INSPECTION / MAINTENANCE / TAX / LICENSE / CUSTOM。
         */
        @Schema(description = "项目标识")
        private String key;

        /**
         * 显示名（自定义项必填，例如：轮胎更换）。
         */
        @Schema(description = "显示名")
        private String label;

        /**
         * 到期日 yyyy-MM-dd（保养项可空，按上次保养 + 间隔推算）。
         */
        @Schema(description = "到期日")
        private String date;

        /**
         * 提前提醒天数（空 = 使用全局默认）。
         */
        @Schema(description = "提前提醒天数")
        private Integer remindDays;

        /**
         * 是否启用。
         */
        @Schema(description = "是否启用")
        private Boolean enabled = true;

        /**
         * 保险公司（保险类，敏感）。
         */
        @Schema(description = "保险公司（敏感）")
        private String insurer;

        /**
         * 保单号（保险类，敏感）。
         */
        @Schema(description = "保单号（敏感）")
        private String policyNo;

        /**
         * 保养间隔月数（保养类）。
         */
        @Schema(description = "保养间隔月数")
        private Integer intervalMonths;

        /**
         * 保养间隔公里（保养类，估算用）。
         */
        @Schema(description = "保养间隔公里")
        private Integer intervalKm;

        /**
         * 上次保养日期（保养类）。
         */
        @Schema(description = "上次保养日期")
        private String lastServiceDate;

        /**
         * 上次保养里程（保养类）。
         */
        @Schema(description = "上次保养里程")
        private Integer lastServiceKm;
    }
}

