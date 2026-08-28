package run.halo.importantdates;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.EqualsAndHashCode;
import run.halo.app.extension.AbstractExtension;
import run.halo.app.extension.GVK;

/**
 * 操作日志自定义模型。
 *
 * <p>记录对重要日期的新增、编辑、删除操作，包含操作类型、目标名称与操作详情。
 * 数据同样存储于 Halo 扩展存储（即站点数据库）。
 *
 * @author important-dates
 * @since 1.1.0
 */
@Data
@EqualsAndHashCode(callSuper = true)
@GVK(group = "importantdates.halo.run", version = "v1alpha1", kind = "OperationLog",
    plural = "operationlogs", singular = "operationlog")
public class OperationLog extends AbstractExtension {

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    private OperationLogSpec spec;

    /**
     * 操作日志字段。
     */
    @Data
    @Schema(description = "操作日志规格")
    public static class OperationLogSpec {

        /**
         * 操作类型：CREATE / UPDATE / DELETE。
         */
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "操作类型")
        private String action;

        /**
         * 目标记录名称（如：结婚纪念日）。
         */
        @Schema(description = "目标记录名称")
        private String targetTitle;

        /**
         * 目标记录标识（metadata.name）。
         */
        @Schema(description = "目标记录标识")
        private String targetName;

        /**
         * 操作详情（如编辑前后的字段差异）。
         */
        @Schema(description = "操作详情")
        private String detail;
    }
}
