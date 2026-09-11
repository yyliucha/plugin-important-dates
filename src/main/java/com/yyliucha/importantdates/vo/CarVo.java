package com.yyliucha.importantdates.vo;

import java.util.ArrayList;
import java.util.List;
import lombok.Data;

/**
 * 前台展示用座驾视图对象（仅公开非敏感字段，1.2.0）。
 *
 * <p>隐私：车牌号仅输出脱敏结果；VIN、发动机号、保单号、购买价格等永不输出；
 * 相册只包含勾选了「前台展示」的照片。
 *
 * @author yyliucha
 * @since 1.2.0
 */
@Data
public class CarVo {

    /** 记录标识。 */
    private String name;

    /** 名称/昵称。 */
    private String displayName;

    /** 品牌。 */
    private String brand;

    /** 车系型号。 */
    private String model;

    /** 脱敏后的车牌号（如 粤B·****5），空表示未填写。 */
    private String plateMasked;

    /** 分类标识（SEDAN/SUV/…/EBIKE/BICYCLE）。 */
    private String vehicleType;

    /** 分类中文名。 */
    private String vehicleTypeLabel;

    /** 分类图标。 */
    private String vehicleTypeIcon;

    /** 能源标识（FUEL/EV/PHEV/HEV/HUMAN）。 */
    private String energyType;

    /** 能源中文名。 */
    private String energyTypeLabel;

    /** 颜色。 */
    private String color;

    /** 相册封面地址（前台可见照片中的封面或第一张）。 */
    private String coverUrl;

    /** 前台可见相册照片。 */
    private List<PhotoVo> photos = new ArrayList<>();

    /** 前台可见照片总数。 */
    private int photoCount;

    /** 车主显示名（人员不可见时为空）。 */
    private String ownerName;

    /** 车主性别（用于皮肤，MALE/FEMALE/其他）。 */
    private String ownerGender;

    /** 常用驾驶人显示名列表。 */
    private List<String> driverNames = new ArrayList<>();

    /** 卡片皮肤：cool / cute / neutral。 */
    private String skin = "neutral";

    /** 前台是否可见。 */
    private boolean frontendVisible;

    /** 是否参与提醒。 */
    private boolean important;

    /** 状态：IN_USE / SOLD / SCRAPPED。 */
    private String status;

    /** 排序权重。 */
    private int sortOrder;

    /** 创建时间（排序平级时的次级依据）。 */
    private String createdAt;

    /** 到期事项（已启用，含已过期，按剩余天数升序）。 */
    private List<CarEventVo> events = new ArrayList<>();

    /** 相册照片（前台可见）。 */
    @Data
    public static class PhotoVo {
        private String url;
        private String name;
        private boolean cover;
    }

    /** 到期事项。 */
    @Data
    public static class CarEventVo {
        private String key;
        private String label;
        private String date;
        private long daysUntil;
        private boolean overdue;
        private String dateText;
        private Integer remindDays;
        /** 所属座驾名称（提醒文案用）。 */
        private String carName;
        /** 所属座驾分类图标。 */
        private String carIcon;
        /** 所属座驾分类标识。 */
        private String carType;
        /** 提醒项类型：date（重要日期）/ car（座驾到期）。 */
        private String eventType = "car";
    }
}
