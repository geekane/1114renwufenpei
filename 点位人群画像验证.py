# --- START OF FILE V11.py ---

import tkinter as tk
from tkinter import scrolledtext, ttk
import threading
import requests
import json
import time
from datetime import datetime
import numpy as np
import csv
import os
import math

# --- 【V11 配置】 ---
API_KEY = "cfed97bf5c90224abbbb2ede4c008d0b" # 请替换为您的高德API Key
GEOCODE_URL = "https://restapi.amap.com/v3/geocode/geo"
AROUND_SEARCH_URL = "https://restapi.amap.com/v5/place/around"
MAX_RETRY_COUNT = 3
RETRY_DELAY = 1
API_REQUEST_DELAY = 0.1
PAGE_SIZE = 25
MAX_PAGE_NUM = 40

# --- POI模型配置 V10 (与上一版相同) ---
MODEL_POI_CONFIG = {
    "positive": {
        "商场购物中心": {"types": "060100|060101", "weight": 2.5, "category": "核心客群", "desc": "高流量商圈的核心标志，客流上限高"},
        "大中专院校": {"types": "141200", "weight": 2.2, "category": "核心客群", "desc": "稳定且庞大的年轻学生客源"},
        "写字楼": {"types": "120100", "weight": 1.8, "category": "核心客群", "saturation": 20, "desc": "白领客群，具备消费能力"},
        "住宅小区": {"types": "120300", "weight": 1.5, "category": "核心客群", "saturation": 25, "desc": "周边居民区，提供基础客流"},
        "青年公寓": {"keywords": "青年公寓|白领公寓|人才公寓", "weight": 2.0, "category": "协同业态", "saturation": 15, "desc": "极精准的年轻、活跃客群聚集地"},
        "夜市美食街": {"keywords": "夜市|美食街", "weight": 1.8, "category": "协同业态", "saturation": 5, "desc": "夜间经济和年轻社交的核心场所"},
        "电影院": {"types": "080601", "weight": 1.6, "category": "协同业态", "saturation": 5, "desc": "互补的娱乐业态，能共享客流"},
        "热门快餐奶茶": {"keywords": "蜜雪冰城|华莱士|瑞幸|星巴克", "weight": 1.5, "category": "协同业态", "saturation": 10, "desc": "年轻消费风向标，验证区域客群活跃度"},
        "KTV": {"types": "080301", "weight": 1.2, "category": "协同业态", "saturation": 10},
        "酒吧": {"types": "080500", "weight": 1.2, "category": "协同业态", "saturation": 15},
        "快餐小吃": {"types": "050300|050100", "weight": 1.0, "category": "协同业态", "saturation": 25},
        "宾馆酒店": {"types": "100100", "weight": 0.8, "category": "协同业态", "saturation": 20},
        "地铁站": {"types": "150500", "weight": 2.0, "category": "基础设施", "desc": "交通枢纽，极大提升辐射范围和客流导入"},
        "公交站": {"types": "150700", "weight": 0.5, "category": "基础设施", "saturation": 20},
    },
    "negative": {
        "网吧": {"types": "080601", "weight": 4.0, "category": "直接竞争"},
        "电竞酒店": {"types": "100108", "weight": 3.5, "category": "直接竞争"},
        "中小学校": {"types": "141202|141203", "weight": 10.0, "category": "政策风险", "desc": "法规红线，200米内禁止开设"},
        "工业园区": {"types": "170205", "weight": 1.5, "category": "风险客群", "desc": "人群画像老化，消费意愿和能力可能不匹配"},
    }
}

# ... 数据备份及后端核心请求函数 (与V10完全相同) ...
def backup_raw_data_to_csv(backup_writer, request_type, params, response_data, poi_name=None):
    if not response_data: return
    backup_writer.writerow({
        "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "request_type": request_type,
        "poi_name": poi_name,
        "request_params": json.dumps(params, ensure_ascii=False),
        "response_status": response_data.get('status', 'N/A'),
        "response_infocode": response_data.get('infocode', 'N/A'),
        "response_count": response_data.get('count', 'N/A'),
        "raw_json_response": json.dumps(response_data, ensure_ascii=False)
    })

class AnalysisCore:
    def __init__(self, logger_func, update_insight_func, backup_writer):
        self.log = logger_func
        self.update_insight = update_insight_func
        self.backup_writer = backup_writer

    def get_coordinates(self, address: str) -> tuple | None:
        self.log(f"📌 正在查询地址: '{address}' ...")
        params = {'key': API_KEY, 'address': address}
        for _ in range(MAX_RETRY_COUNT):
            try:
                time.sleep(API_REQUEST_DELAY)
                response = requests.get(GEOCODE_URL, params=params, timeout=10)
                response.raise_for_status()
                data = response.json()
                backup_raw_data_to_csv(self.backup_writer, "geocode", params, data)
                if data.get('status') == '1' and int(data.get('count', 0)) > 0:
                    lon, lat = map(float, data['geocodes'][0]['location'].split(','))
                    self.log(f"✅ 查询成功: {lon:.6f}, {lat:.6f}\n")
                    return lon, lat
            except requests.exceptions.RequestException: time.sleep(RETRY_DELAY)
        self.log(f"❌ 地理编码失败: {address}"); return None

    def search_nearby_poi_details_full(self, location_coords: tuple, radius: int, poi_types: str = None, keywords: str = None, poi_name: str = "Unknown") -> list:
        all_pois, page_num = [], 1
        while page_num <= MAX_PAGE_NUM:
            params = {'key': API_KEY, 'location': f"{location_coords[0]},{location_coords[1]}", 'radius': radius, 'page_size': PAGE_SIZE, 'page_num': page_num, 'show_fields': 'business'}
            if keywords: params['keywords'] = keywords
            elif poi_types: params['types'] = poi_types
            else: break
            try:
                time.sleep(API_REQUEST_DELAY)
                response = requests.get(AROUND_SEARCH_URL, params=params, timeout=10)
                response.raise_for_status()
                data = response.json()
                backup_raw_data_to_csv(self.backup_writer, "around_search", params, data, poi_name=poi_name)
                if data.get('status') == '1':
                    pois_on_page = data.get('pois', [])
                    if not pois_on_page: break
                    all_pois.extend(pois_on_page)
                    if len(pois_on_page) < PAGE_SIZE: break
                    page_num += 1
                else: break
            except (requests.exceptions.RequestException, json.JSONDecodeError): break
        return all_pois

    def clean_poi_list(self, poi_list: list, expected_types: str) -> list:
        if not expected_types: return poi_list
        cleaned_list, expected_type_set = [], set(expected_types.split('|'))
        for poi in poi_list:
            poi_typecodes = set(poi.get('typecode', '').split(';'))
            if not expected_type_set.isdisjoint(poi_typecodes):
                cleaned_list.append(poi)
        if len(poi_list) != len(cleaned_list):
            self.log(f"    -> 数据清洗: {len(poi_list)}条 -> {len(cleaned_list)}条有效数据。")
        return cleaned_list

    def analyze_poi_details(self, poi_list: list) -> dict:
        ratings, costs = [], []
        for poi in poi_list:
            business = poi.get('business', {})
            try:
                if business.get('rating'): ratings.append(float(business['rating']))
                if business.get('cost') and float(business['cost']) > 0: # 过滤掉价格为0或无效的数据
                    costs.append(float(business['cost']))
            except (ValueError, TypeError): continue
        avg_rating = sum(ratings) / len(ratings) if ratings else 0
        avg_cost = sum(costs) / len(costs) if costs else 0
        return {'avg_rating': avg_rating, 'avg_cost': avg_cost}

    def get_rating_bonus(self, avg_rating):
        if avg_rating > 4.2: return (avg_rating - 4.2) * 25
        if avg_rating < 3.8 and avg_rating > 0: return (avg_rating - 3.8) * 20
        return 0

    # 【改】重构消费画像加分逻辑，贯彻“越便宜越好”的原则
    def get_cost_bonus(self, avg_cost):
        """根据周边餐饮人均消费评估消费画像匹配度"""
        if avg_cost <= 0: return 0 # 无有效数据
        if avg_cost <= 35: return 20  # 极佳，消费水平非常亲民，完美匹配目标客群
        if avg_cost <= 50: return 10  # 不错，消费水平合理，匹配度高
        if avg_cost <= 80: return -5   # 偏高，对核心客群有一定消费压力
        return -15 # 过高，区域消费与目标客群严重不符

    # ... append_to_summary_csv 和 get_rating_and_suggestion 与V10相同 ...
    def append_to_summary_csv(self, summary_data):
        timestamp = datetime.now().strftime("%Y%m%d")
        filename = f"analysis_summary_{timestamp}.csv"
        file_exists = os.path.isfile(filename)
        all_poi_names = list(MODEL_POI_CONFIG['positive'].keys()) + list(MODEL_POI_CONFIG['negative'].keys())
        fieldnames = ['分析时间', '地址', '半径(米)', '总分', '评级', '核心客群分', '协同业态分', '基础设施分', '竞争环境分', '风险项分', '一句话建议', '经度', '纬度', '竞争对手数量', '中小学数量'] + \
                     [f"{name}_数量" for name in all_poi_names]
        with open(filename, 'a', newline='', encoding='utf-8-sig') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames, extrasaction='ignore')
            if not file_exists: writer.writeheader()
            writer.writerow(summary_data)
        self.log(f"✅ 分析结果已追加到汇总表: {filename}")

    def get_rating_and_suggestion(self, total_score, categorized_scores):
        policy_risk_count = categorized_scores.get("政策风险", {}).get("count", 0)
        if policy_risk_count > 0:
            return "F  高危", f"【一票否决】周边{policy_risk_count}家中小学，存在严重政策风险，绝对不建议！"
        if total_score >= 180: return "S+ 顶级商圈", "现象级位置，客流和消费力顶尖，是市场标杆，建议不计成本拿下。"
        if 120 <= total_score < 180: return "A  核心区域", "客群精准，配套完善，是理想选择，成功率极高。"
        if 70 <= total_score < 120: return "B  潜力区域", "具备核心优势（如大学城或大型社区），可通过运营弥补短板。"
        if 40 <= total_score < 70: return "C  谨慎考虑", "客流或配套有明显短板，需深入调研特定客群，风险与机遇并存。"
        return "D  风险较高", "缺乏核心客流支撑，商业环境不成熟，不建议选择。"

    def evaluate_location(self, address: str, radius: int):
        self.log("="*60); self.log(f"🚀 开始新任务: {address} (半径: {radius}米)")
        coords = self.get_coordinates(address)
        if not coords: self.log("❌ 任务终止。"); return
        
        # ... 定量分析部分与V10完全相同 ...
        categorized_scores = {
            "核心客群": {"score": 0, "count": 0}, "协同业态": {"score": 0, "count": 0},
            "基础设施": {"score": 0, "count": 0}, "直接竞争": {"score": 0, "count": 0},
            "政策风险": {"score": 0, "count": 0}, "风险客群": {"score": 0, "count": 0}
        }
        summary_data = {'地址': address, '半径(米)': radius, '经度': f"{coords[0]:.6f}", '纬度': f"{coords[1]:.6f}"}
        all_poi_configs = list(MODEL_POI_CONFIG['positive'].items()) + list(MODEL_POI_CONFIG['negative'].items())
        
        for i, (name, config) in enumerate(all_poi_configs):
            is_positive = name in MODEL_POI_CONFIG['positive']
            self.log(f"  [{i+1}/{len(all_poi_configs)}] 正在查询({config['category']}): {name}...")
            raw_poi_list = self.search_nearby_poi_details_full(coords, radius, config.get('types'), config.get('keywords'), poi_name=name)
            if name == "中小学校":
                strict_radius = 200
                self.log(f"    -> 对“中小学校”执行 {strict_radius}米 严格半径筛查...")
                raw_poi_list = [p for p in raw_poi_list if int(p.get('distance', 999)) <= strict_radius]
            cleaned_poi_list = self.clean_poi_list(raw_poi_list, config.get('types'))
            count = len(cleaned_poi_list)
            category = config['category']
            impact = 0
            if count > 0:
                if is_positive:
                    saturation = config.get('saturation')
                    effective_count = saturation * (1 - np.exp(-count / saturation)) if saturation else count
                    impact = effective_count * config['weight']
                    self.log(f"    -> 发现 {count} 个, 有效计分 {effective_count:.1f}, 贡献 +{impact:.1f}")
                else:
                    impact = count * config['weight']
                    self.log(f"    -> 发现 {count} 个, 影响 -{impact:.1f}")
            categorized_scores[category]['score'] += impact if is_positive else -impact
            categorized_scores[category]['count'] += count
            summary_data[f"{name}_数量"] = count

        quantitative_score = (categorized_scores['核心客群']['score'] + categorized_scores['协同业态']['score'] + categorized_scores['基础设施']['score'])
        negative_score = (categorized_scores['直接竞争']['score'] + categorized_scores['政策风险']['score'] + categorized_scores['风险客群']['score'])
        base_score = quantitative_score - negative_score

        # 【改】质化分析数据源更精准
        self.log("\n[+] 正在进行周边【餐饮消费】画像分析...")
        # 只查询“餐饮服务”大类(050000)，确保数据纯净
        qualitative_pois = self.search_nearby_poi_details_full(coords, radius, poi_types="050000", poi_name="餐饮服务")
        
        qualitative_results = self.analyze_poi_details(qualitative_pois)
        avg_rating, avg_cost = qualitative_results['avg_rating'], qualitative_results['avg_cost']
        quality_bonus = self.get_rating_bonus(avg_rating)
        profile_bonus = self.get_cost_bonus(avg_cost) # 使用新的评分模型
        total_score = base_score + quality_bonus + profile_bonus
        
        self.log(f"  - 周边餐饮平均评分: {avg_rating:.2f} -> 质量加分: {quality_bonus:+.1f}")
        self.log(f"  - 周边餐饮人均消费: {avg_cost:.2f}元 -> 画像加分: {profile_bonus:+.1f}")
        self.update_insight(avg_rating, avg_cost, quality_bonus, profile_bonus)

        # ... 最终报告生成与V10相同 ...
        self.log("\n" + "="*60); self.log("📊 最终评估报告")
        self.log(f"  [+] 核心客群基础: {categorized_scores['核心客群']['score']:.1f}分 (来自大学、社区、写字楼等)")
        self.log(f"  [+] 商业协同效应: {categorized_scores['协同业态']['score']:.1f}分 (来自商场、夜市、影院等)")
        self.log(f"  [+] 基础设施支撑: {categorized_scores['基础设施']['score']:.1f}分 (来自地铁、公交站等)")
        self.log(f"  [-] 竞争环境压力: -{categorized_scores['直接竞争']['score']:.1f}分 ({categorized_scores['直接竞争']['count']}个直接竞争对手)")
        self.log(f"  [-] 潜在风险因素: -{categorized_scores['政策风险']['score'] + categorized_scores['风险客群']['score']:.1f}分 (中小学: {categorized_scores['政策风险']['count']}个, 工业区等: {categorized_scores['风险客群']['count']}个)")
        self.log("-" * 20)
        self.log(f"  基础得分 (客群+商业-竞争-风险): {base_score:.2f}")
        self.log(f"  环境加分 (餐饮评级+消费水平): {quality_bonus + profile_bonus:+.2f}")
        self.log(f"  最终总分: {total_score:.2f}")
        grade, recommendation = self.get_rating_and_suggestion(total_score, categorized_scores)
        self.log(f"  评级: {grade}")
        self.log(f"  建议: {recommendation}")
        self.log("="*60 + "\n")

        summary_data.update({
            '分析时间': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            '总分': f"{total_score:.2f}", '评级': grade.split(" ")[0], '一句话建议': recommendation,
            '核心客群分': f"{categorized_scores['核心客群']['score']:.2f}", '协同业态分': f"{categorized_scores['协同业态']['score']:.2f}",
            '基础设施分': f"{categorized_scores['基础设施']['score']:.2f}", '竞争环境分': f"{-categorized_scores['直接竞争']['score']:.2f}",
            '风险项分': f"{-categorized_scores['政策风险']['score'] - categorized_scores['风险客群']['score']:.2f}",
            '竞争对手数量': categorized_scores['直接竞争']['count'], '中小学数量': categorized_scores['政策风险']['count']
        })
        self.append_to_summary_csv(summary_data)


# --- GUI界面 (与V10完全相同, 仅修改标题) ---
class App:
    def __init__(self, root):
        self.root = root
        self.root.title("网吧选址分析器 v11.0 (消费画像优化版)")
        self.root.geometry("800x650")

        main_frame = ttk.Frame(root, padding="10"); main_frame.pack(fill=tk.BOTH, expand=True)
        input_frame = ttk.LabelFrame(main_frame, text="参数设置", padding="10"); input_frame.pack(fill=tk.X)
        ttk.Label(input_frame, text="地址输入 (一行一个):").pack(anchor='w')
        self.address_text = tk.Text(input_frame, height=5, width=60); self.address_text.pack(fill=tk.X, expand=True, pady=5)
        self.address_text.insert(tk.END, "成都东原时光道\n成都卡密尔电竞\n成都保利·叶语")
        ttk.Label(input_frame, text="搜索半径 (米):").pack(anchor='w', side=tk.LEFT, padx=(0, 5))
        self.radius_var = tk.StringVar(value="800")
        self.radius_entry = ttk.Entry(input_frame, textvariable=self.radius_var, width=10); self.radius_entry.pack(side=tk.LEFT)
        self.start_button = ttk.Button(input_frame, text="开始分析", command=self.start_analysis_thread); self.start_button.pack(side=tk.RIGHT, padx=10)

        log_frame = ttk.LabelFrame(main_frame, text="分析日志", padding="10"); log_frame.pack(fill=tk.BOTH, expand=True, pady=(10,0))
        self.log_text = scrolledtext.ScrolledText(log_frame, wrap=tk.WORD, state='disabled'); self.log_text.pack(fill=tk.BOTH, expand=True)
        qualitative_frame = ttk.LabelFrame(main_frame, text="餐饮消费画像洞察", padding="10"); qualitative_frame.pack(fill=tk.X, pady=(5,0))
        self.qualitative_label = ttk.Label(qualitative_frame, text="等待分析...", font=("", 10))
        self.qualitative_label.pack(anchor='w')

    def log_to_gui(self, message):
        def _update():
            self.log_text.config(state='normal'); self.log_text.insert(tk.END, message + '\n')
            self.log_text.config(state='disabled'); self.log_text.see(tk.END)
        self.root.after(0, _update)

    def update_insight_display(self, avg_rating, avg_cost, quality_bonus, profile_bonus):
        def _update():
            text = (f"餐饮质量: 平均评分 {avg_rating:.2f} (加分: {quality_bonus:+.1f}) | "
                    f"消费水平: 人均消费 {avg_cost:.2f}元 (画像加分: {profile_bonus:+.1f})")
            self.qualitative_label.config(text=text)
        self.root.after(0, _update)

    def start_analysis_thread(self):
        addresses = [addr.strip() for addr in self.address_text.get("1.0", tk.END).strip().split('\n') if addr.strip()]
        try: radius = int(self.radius_var.get()); assert 0 < radius <= 50000
        except (ValueError, AssertionError): self.log_to_gui("错误: 半径必须是 1 到 50000 之间的数字。"); return
        if not addresses: self.log_to_gui("错误: 请至少输入一个地址。"); return
        self.start_button.config(state='disabled')
        self.update_insight_display(0, 0, 0, 0); self.qualitative_label.config(text="正在分析...")
        backup_dir = "raw_data_backup"
        if not os.path.exists(backup_dir): os.makedirs(backup_dir)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        csv_lock = threading.Lock()
        threading.Thread(target=self.run_analysis_with_backup, args=(addresses, radius, backup_dir, timestamp, csv_lock), daemon=True).start()

    def run_analysis_with_backup(self, addresses, radius, backup_dir, timestamp, lock):
        for i, address in enumerate(addresses):
            safe_address = "".join(x for x in address if x.isalnum())
            backup_filename = os.path.join(backup_dir, f"backup_{safe_address}_{timestamp}_{i+1}.csv")
            self.log_to_gui(f"📝 原始数据将备份至: {backup_filename}")
            with open(backup_filename, 'w', newline='', encoding='utf-8-sig') as csvfile:
                fieldnames = ["timestamp", "request_type", "poi_name", "request_params", "response_status", "response_infocode", "response_count", "raw_json_response"]
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                writer.writeheader()
                with lock:
                    self.core = AnalysisCore(self.log_to_gui, self.update_insight_display, writer)
                self.core.evaluate_location(address, radius)
        self.log_to_gui("🎉🎉🎉 所有任务已完成！ 🎉🎉🎉")
        self.root.after(0, lambda: self.start_button.config(state='normal'))

if __name__ == "__main__":
    root = tk.Tk()
    app = App(root)
    root.mainloop()

# --- END OF FILE V11.py ---
