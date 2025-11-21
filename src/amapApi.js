/* global AMap */

// 简化的POI模型配置
const SIMPLIFIED_POI_CONFIG = {
    // 核心客群
    core: [
        { name: "大中专院校", types: "141200", weight: 2.5 },
        { name: "写字楼", types: "120100", weight: 1.8 },
        { name: "住宅小区", types: "120300", weight: 1.5 },
    ],
    // 协同业态
    synergy: [
        { name: "商场购物中心", types: "060100|060101", weight: 2.0 },
        { name: "电影院", types: "080601", weight: 1.2 },
        { name: "热门快餐奶茶", keywords: "蜜雪冰城|瑞幸|星巴克", weight: 1.5 },
    ],
    // 基础设施
    infra: [
        { name: "地铁站", types: "150500", weight: 2.0 },
    ],
    // 竞争与风险
    negative: [
        { name: "网吧", types: "080601", weight: 4.0 }, // 注意：电影院和网吧typecode冲突，后端查询时会用keywords区分
        { name: "中小学校", types: "141202|141203", weight: 10.0, radius: 200 }, // 200米严格半径
    ]
};

/**
 * 使用高德API将地址转换为经纬度坐标
 * @param {string} address - 需要查询的地址
 * @returns {Promise<AMap.LngLat>} - 返回一个包含经纬度的Promise
 */
const getCoordinates = (address) => {
    return new Promise((resolve, reject) => {
        const geocoder = new AMap.Geocoder();
        geocoder.getLocation(address, (status, result) => {
            if (status === 'complete' && result.info === 'OK' && result.geocodes.length > 0) {
                console.log("地址解析成功:", result.geocodes[0].location);
                resolve(result.geocodes[0].location);
            } else {
                reject(new Error(`地址解析失败: ${address}`));
            }
        });
    });
};

/**
 * 在指定坐标周围搜索POI
 * @param {AMap.LngLat} location - 经纬度坐标
 * @param {number} radius - 搜索半径（米）
 * @param {string} types - POI类型代码
 * @param {string} keywords - 搜索关键词
 * @returns {Promise<Array>} - 返回POI点数组的Promise
 */
const searchNearby = (location, radius, types, keywords) => {
    return new Promise((resolve, reject) => {
        const placeSearch = new AMap.PlaceSearch({ pageSize: 50, pageIndex: 1 });
        const searchOptions = {
            city: '全国', // 在指定经纬度周边搜索，城市限制作用不大
        };
        if (types) searchOptions.type = types;
        
        placeSearch.searchNear(location, radius, searchOptions, (status, result) => {
            if (status === 'complete' && result.info === 'OK') {
                resolve(result.poiList.pois);
            } else if (status === 'no_data') {
                resolve([]);
            } else {
                reject(new Error(`周边搜索失败: ${result.info}`));
            }
        });
    });
};

/**
 * 主分析函数
 * @param {string} address - 要分析的地址
 * @returns {Promise<Object>} - 返回分析结果对象的Promise
 */
export const analyzeLocationPotential = async (address) => {
    const mainRadius = 800; // 主要分析半径
    let totalScore = 0;
    const analysisResult = {
        address: address,
        totalScore: 0,
        rating: 'D',
        recommendation: '数据不足或分析失败',
        details: {}
    };

    try {
        const location = await getCoordinates(address);
        
        const allPromises = [];

        // 遍历所有POI配置并发起搜索
        for (const category in SIMPLIFIED_POI_CONFIG) {
            SIMPLIFIED_POI_CONFIG[category].forEach(poiConfig => {
                const searchRadius = poiConfig.radius || mainRadius;
                const promise = searchNearby(location, searchRadius, poiConfig.types, poiConfig.keywords)
                    .then(pois => ({
                        ...poiConfig,
                        category,
                        count: pois.length,
                        score: (category === 'negative' ? -1 : 1) * pois.length * poiConfig.weight
                    }));
                allPromises.push(promise);
            });
        }

        const results = await Promise.all(allPromises);

        // 汇总分数
        results.forEach(res => {
            totalScore += res.score;
            analysisResult.details[res.name] = { count: res.count, score: res.score };
        });

        // 最终评分
        analysisResult.totalScore = Math.max(0, totalScore); // 分数不低于0

        if (analysisResult.details["中小学校"]?.count > 0) {
            analysisResult.rating = "F";
            analysisResult.recommendation = "【一票否决】200米内有中小学，存在严重政策风险！";
        } else if (totalScore >= 80) {
            analysisResult.rating = "A";
            analysisResult.recommendation = "核心区域，客群精准，成功率极高。";
        } else if (totalScore >= 50) {
            analysisResult.rating = "B";
            analysisResult.recommendation = "潜力区域，具备核心优势，建议进一步调研。";
        } else if (totalScore >= 20) {
            analysisResult.rating = "C";
            analysisResult.recommendation = "谨慎考虑，可能存在明显短板。";
        } else {
            analysisResult.rating = "D";
            analysisResult.recommendation = "风险较高，缺乏核心客流支撑。";
        }

        return analysisResult;

    } catch (error) {
        console.error("分析过程中出现错误:", error);
        // 返回包含错误信息的对象
        return { ...analysisResult, recommendation: error.message };
    }
};