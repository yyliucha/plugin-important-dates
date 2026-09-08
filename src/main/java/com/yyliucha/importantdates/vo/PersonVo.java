package com.yyliucha.importantdates.vo;

import lombok.Data;

/**
 * 前台展示用人员视图对象（仅公开非隐私字段）。
 *
 * @author yyliucha
 * @since 1.0.5
 */
@Data
public class PersonVo {

    /**
     * 人员标识。
     */
    private String name;

    /**
     * 姓名。
     */
    private String displayName;

    /**
     * 昵称/称呼。
     */
    private String nickname;

    /**
     * 关系。
     */
    private String relation;

    /**
     * 生日显示文本。
     */
    private String birthdayText;

    /**
     * 下一次生日对应的阳历日期（yyyy-MM-dd）。
     */
    private String nextSolarDate;

    /**
     * 距下一次生日的天数（>= 0）。
     */
    private long daysUntil;

    /**
     * 前台是否可见（false = 仅后台，不出现在前台）。
     */
    private boolean frontendVisible;

    /**
     * 大头贴照片地址（仅一张；前台由设置「前台展示大头贴」控制，后台始终显示）。
     */
    private String avatar;

    /**
     * 排序权重（拖拽排序；越小越靠前）。
     */
    private int sortOrder;

    /**
     * 创建时间（排序平级时的次级排序依据）。
     */
    private String createdAt;
}
