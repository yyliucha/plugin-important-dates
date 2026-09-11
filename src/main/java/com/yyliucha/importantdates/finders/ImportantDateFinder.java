package com.yyliucha.importantdates.finders;

import reactor.core.publisher.Flux;
import com.yyliucha.importantdates.vo.CarVo;
import com.yyliucha.importantdates.vo.ImportantDateVo;
import com.yyliucha.importantdates.vo.PersonVo;

/**
 * 供主题模板调用的数据查询接口。
 *
 * <p>在主题模板中通过 {@code $(importantDateFinder.listAll())} 获取全部重要日期，
 * {@code $(importantDateFinder.listAllPeople())} 获取人员列表，
 * {@code $(importantDateFinder.listAllCars())} 获取座驾（汽车/电瓶车/自行车）列表。
 *
 * @author yyliucha
 * @since 1.0.5
 */
public interface ImportantDateFinder {

    /**
     * 全部重要日期（按剩余天数升序，仅前台可见项）。
     */
    Flux<ImportantDateVo> listAll();

    /**
     * 即将到来的重要日期（重要 + 前台可见 + N 天内），按剩余天数升序。
     *
     * @param days 提前天数（>= 0，含当天）
     */
    Flux<ImportantDateVo> listUpcoming(int days);

    /**
     * 全部人员（仅前台可见项）。
     */
    Flux<PersonVo> listAllPeople();

    /**
     * 全部座驾（仅前台可见项，按拖拽排序权重）。
     */
    Flux<CarVo> listAllCars();

    /**
     * 即将到来的座驾到期事项（在用车 + 前台可见 + 重要 + N 天内，含近期已过期），按剩余天数升序。
     *
     * @param days 提前天数（>= 0，含当天）
     */
    Flux<CarVo.CarEventVo> listUpcomingCarEvents(int days);
}
