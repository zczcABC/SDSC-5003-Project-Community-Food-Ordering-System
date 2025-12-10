(function() {
    function fmtMoney(n) {
        return '¥' + ((n/100)*100).toFixed(2);
    }

    // 首页逻辑
    if (window.location.pathname === '/') {
        function reloadMenu() {
        console.log('重新加载菜单以更新库存...');

        fetch('/api/menu')
            .then(r => {
                if (!r.ok) throw new Error(`HTTP错误 ${r.status}`);
                return r.json();
            })
            .then(res => {
                if (res.code === 0 && Array.isArray(res.data)) {
                    menu = res.data;  // 更新全局菜单数据
                    console.log('菜单已刷新，库存已更新');
                    renderMenu();     // 重新渲染菜单

                    // 显示库存更新提示（可选）
                    showStockAlert();
                }
            })
            .catch(err => {
                console.error('刷新菜单失败:', err);
            });
    }

    // 库存更新提示
    function showStockAlert() {
        const alert = document.getElementById('stockUpdateAlert');
        if (alert) {
            alert.style.display = 'block';
            setTimeout(() => alert.style.display = 'none', 3000);
        }
    }
    console.log('初始化点餐页面');

    let menu = [];
    let cart = JSON.parse(localStorage.getItem('cart') || '[]');
    let currentCategory = '全部'; // 当前选中的类别

    const menuGrid = document.getElementById('menuGrid');
    if (!menuGrid) {
        console.error('错误：找不到ID为 menuGrid 的元素');
        return;
    }

    // 清空占位符
    menuGrid.innerHTML = '';

    // 创建类别导航栏
    const categoryNav = document.createElement('div');
    categoryNav.id = 'categoryNav';
    categoryNav.className = 'category-nav';
    menuGrid.parentNode.insertBefore(categoryNav, menuGrid);

    // 加载菜单数据
    fetch('/api/menu')
        .then(r => {
            if (!r.ok) throw new Error(`HTTP错误 ${r.status}`);
            return r.json();
        })
        .then(res => {
            if (res.code === 0 && Array.isArray(res.data)) {
                menu = res.data;
                console.log('获取到', menu.length, '个菜品');
                renderCategoryNav();  // 渲染类别导航
                renderMenu();         // 渲染菜单
            } else {
                throw new Error(`数据异常: code=${res.code}`);
            }
        })
        .catch(err => {
            console.error('加载菜单失败:', err);
            menuGrid.innerHTML = `<div style="color:red; padding:2rem;">加载失败: ${err.message}</div>`;
        });

    // 渲染类别导航栏
    function renderCategoryNav() {
        const categories = ['全部', ...new Set(menu.map(item => item.category))];
        console.log('类别列表:', categories);

        categoryNav.innerHTML = categories.map(cat => `
            <button class="category-btn ${cat === currentCategory ? 'active' : ''}" 
                    data-category="${cat}">
                ${cat}
            </button>
        `).join('');

        // 绑定点击事件
        categoryNav.querySelectorAll('.category-btn').forEach(btn => {
            btn.onclick = function() {
                currentCategory = this.dataset.category;
                console.log('切换类别到:', currentCategory);

                // 更新按钮状态
                categoryNav.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');

                // 重新渲染菜单
                renderMenu();
            };
        });
    }

    // 渲染菜单（按类别）
    function renderMenu() {
        console.log('渲染菜单，当前类别:', currentCategory);

        // 按类别分组
        const grouped = menu.reduce((acc, item) => {
            if (!acc[item.category]) acc[item.category] = [];
            acc[item.category].push(item);
            return acc;
        }, {});

        let html = '';

        if (currentCategory === '全部') {
            // 显示所有类别
            for (const [category, items] of Object.entries(grouped)) {
                html += renderCategorySection(category, items);
            }
        } else {
            // 只显示选中类别
            const items = grouped[currentCategory] || [];
            html = renderCategorySection(currentCategory, items);
        }

        menuGrid.innerHTML = html;
        console.log('菜单渲染完成');
    }

    // 渲染单个类别区块
    function renderCategorySection(category, items) {
        if (!items || items.length === 0) return '';

        return `
            <section class="category-section" data-category="${category}">
                <h2 class="category-title">${category}</h2>
                <div class="menu-grid">
                    ${items.map(item => renderMenuCard(item)).join('')}
                </div>
            </section>
        `;
    }

    // 渲染单个菜品卡片
    function renderMenuCard(item) {
        const inStock = item.stock_status === '有货';
        const stockClass = inStock ? 'in-stock' : 'out-stock';
        const stockText = inStock ? `库存：${item.stock_quantity}` : '缺货';

        return `
            <div class="menu-card" data-id="${item.id}">
                <h4>${item.name}</h4>
                <div class="price">${fmtMoney(item.price)}</div>
                <div class="stock ${stockClass}">${stockText}</div>
                ${inStock ? `
                    <label>数量：
                        <input type="number" min="1" max="${item.stock_quantity}" value="1" 
                               id="qty-${item.id}" class="quantity-input">
                    </label>
                    <button onclick="addToCart(${item.id})" class="btn-add">加入购物车</button>
                ` : '<button disabled class="btn-disabled">暂时售罄</button>'}
            </div>
        `;
    }

    // 添加到购物车
    window.addToCart = function(id) {
        const input = document.getElementById(`qty-${id}`);
        const quantity = parseInt(input?.value || 1, 10);
        const item = menu.find(m => m.id === id);

        if (!item || quantity <= 0) {
            alert('商品信息错误！');
            return;
        }

        if (quantity > item.stock_quantity) {
            alert(`库存不足！最多可购买 ${item.stock_quantity} 份`);
            return;
        }

        const existing = cart.find(c => c.menuItemId === id);
        if (existing) {
            existing.quantity += quantity;
        } else {
            cart.push({
                menuItemId: id,
                name: item.name,
                price: parseFloat(item.price),
                quantity: quantity
            });
        }

        localStorage.setItem('cart', JSON.stringify(cart));
        alert(`已添加 ${item.name} × ${quantity}`);
        renderCart(); // 更新购物车显示
    };

    // 渲染购物车
    function renderCart() {
        // ... 保持原有购物车逻辑不变 ...
        const container = document.getElementById('cartItems');
        const footer = document.getElementById('cartFooter');
        if (!container) return;

        if (cart.length === 0) {
            container.innerHTML = '<p class="empty-cart">购物车为空，快去选购吧！</p>';
            if (footer) footer.style.display = 'none';
            return;
        }

        container.innerHTML = '';
        let total = 0;
        cart.forEach(c => {
            const sub = c.price * c.quantity;
            total += sub;
            const row = document.createElement('div');
            row.className = 'cart-item';
            row.innerHTML = `
                <span>${c.name} × ${c.quantity}</span>
                <span>${fmtMoney(sub)}</span>
                <button class="remove-btn" onclick="removeFromCart(${c.menuItemId})">删除</button>
            `;
            container.appendChild(row);
        });

        if (footer) {
            document.getElementById('cartTotal').textContent = fmtMoney(total);
            footer.style.display = 'block';
        }
    }

    // 删除购物车项
    window.removeFromCart = function(id) {
        cart = cart.filter(c => c.menuItemId !== id);
        localStorage.setItem('cart', JSON.stringify(cart));
        renderCart();
    };

    // 初始渲染购物车
    renderCart();
    console.log('首页初始化完成');

        // 弹出订单信息模态框
        const modal = document.getElementById('orderFormModal');
        const checkoutBtn = document.getElementById('checkoutBtn');
        const closeBtn = document.querySelector('.close');

        checkoutBtn.onclick = () => {
            if (cart.length === 0) {
                alert('购物车为空！');
                return;
            }
            modal.style.display = 'block';
        };
        closeBtn.onclick = () => modal.style.display = 'none';
        window.onclick = e => {
            if (e.target === modal) modal.style.display = 'none';
        };

        // 提交订单
        document.getElementById('orderForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            const customer = {
                name: formData.get('name'),
                phone: formData.get('phone'),
                address: formData.get('address')
            };
            const items = cart.map(c => ({
                menu_item_id: c.menuItemId,
                quantity: c.quantity
            }));
            fetch('/api/order', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({customer, items})
            })
                .then(r => r.json())
                .then(res => {
                    if (res.code === 0) {
                        alert(`下单成功！订单号：${res.data.order_id}`);
                        cart = [];
                        localStorage.removeItem('cart');
                        renderCart();
                        modal.style.display = 'none';
                        document.getElementById('orderForm').reset();
                        reloadMenu()
                    } else {
                        alert('下单失败：' + res.msg);
                    }
                })
                .catch(err => console.error(err));
        });
    }

    // --------------------- 管理页逻辑 ---------------------
    if (window.location.pathname === '/admin') {
        // 渲染销售趋势折线图
        fetch('/api/sales_data')
            .then(r => r.json())
            .then(res => {
                if (res.code === 0) {
                    const daily = res.data.daily || [];
                    const labels = daily.map(d => d.date);
                    const data = daily.map(d => parseFloat(d.total));
                    const ctx = document.getElementById('dailySalesChart').getContext('2d');
                    new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels,
                            datasets: [{
                                label: '日销售额（¥）',
                                data,
                                borderColor: '#FF6F00',
                                backgroundColor: 'rgba(255, 111, 0, 0.1)',
                                tension: 0.3
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                                y: { beginAtZero: true }
                            }
                        }
                    });

                    // 类别饼图
                    const catData = res.data.category || [];
                    new Chart(document.getElementById('categoryPieChart'), {
                        type: 'pie',
                        data: {
                            labels: catData.map(c => c.category),
                            datasets: [{
                                data: catData.map(c => parseFloat(c.total)),
                                backgroundColor: ['#FF6F00', '#4CAF50', '#2196F3', '#FFC107', '#9C27B0']
                            }]
                        },
                        options: { responsive: true, maintainAspectRatio: false }
                    });
                }
            })
            .catch(err => console.error(err));

        // 热销 TOP 10 条形图
        fetch('/api/popular_items?top=10')
            .then(r => r.json())
            .then(res => {
                if (res.code === 0) {
                    const items = res.data || [];
                    new Chart(document.getElementById('popularBarChart'), {
                        type: 'bar',
                        data: {
                            labels: items.map(i => i.name),
                            datasets: [{
                                label: '销量',
                                data: items.map(i => i.total_sold),
                                backgroundColor: '#4CAF50'
                            }]
                        },
                        options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y' }
                    });
                }
            })
            .catch(err => console.error(err));

        // 加载订单列表
        function loadOrders() {
            fetch('/api/orders?page=1&limit=50')
                .then(r => r.json())
                .then(res => {
                    if (res.code === 0) {
                        const tbody = document.querySelector('#ordersTable tbody');
                        tbody.innerHTML = '';
                        res.data.forEach(order => {
                            const tr = document.createElement('tr');
                            tr.innerHTML = `
                                <td>${order.id}</td>
                                <td>${order.customer_name}</td>
                                <td>¥${parseFloat(order.total_amount).toFixed(2)}</td>
                                <td>${new Date(order.order_time).toLocaleString('zh-CN')}</td>
                                <td>
                                    <select onchange="updateOrderStatus(${order.id}, this.value)">
                                        <option value="pending" ${order.status==='pending'?'selected':''}>待处理</option>
                                        <option value="confirmed" ${order.status==='confirmed'?'selected':''}>已确认</option>
                                        <option value="delivered" ${order.status==='delivered'?'selected':''}>已配送</option>
                                        <option value="cancelled" ${order.status==='cancelled'?'selected':''}>已取消</option>
                                    </select>
                                </td>
                                <td>
                                    <button onclick="viewOrderDetails(${order.id})">详情</button>
                                </td>
                            `;
                            tbody.appendChild(tr);
                        });
                    }
                })
                .catch(err => console.error(err));
        }

        // 更新订单状态
        window.updateOrderStatus = function(orderId, status) {
            fetch(`/api/order/${orderId}/status`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({status})
            })
                .then(r => r.json())
                .then(res => {
                    if (res.code !== 0) {
                        alert('状态更新失败：' + res.msg);
                    }
                })
                .catch(err => console.error(err));
        };

        // 查看订单详情
        const orderModal = document.createElement('div');
        orderModal.id = 'orderDetailModal';
        orderModal.className = 'modal';
        orderModal.innerHTML = `
            <div class="modal-content order-detail-modal">
                <span class="close">&times;</span>
                <h2>订单详情</h2>
                <div id="orderDetailContent">
                    <!-- 动态填充内容 -->
                </div>
            </div>
        `;
        document.body.appendChild(orderModal);

        // 查看订单详情函数
        window.viewOrderDetails = function(orderId) {
            console.log('🔍 查看订单详情:', orderId);

            fetch(`/api/order/${orderId}/details`)
                .then(r => r.json())
                .then(res => {
                    if (res.code === 0) {
                        const { order, items } = res.data;
                        renderOrderDetailModal(order, items);
                        orderModal.style.display = 'block';
                    } else {
                        alert('获取详情失败: ' + res.msg);
                    }
                })
                .catch(err => {
                    console.error('❌ 获取订单详情失败:', err);
                    alert('网络错误，请稍后重试');
                });
        };

        // 渲染订单详情内容
        function renderOrderDetailModal(order, items) {
            const content = document.getElementById('orderDetailContent');

            // 订单概要
            const statusText = {
                'pending': '待处理',
                'confirmed': '已确认',
                'delivered': '已配送',
                'cancelled': '已取消'
            }[order.status] || order.status;

            const orderInfo = `
                <div class="order-summary">
                    <h3>订单 #${order.id}</h3>
                    <p><strong>顾客：</strong>${order.customer_name}</p>
                    <p><strong>电话：</strong>${order.phone}</p>
                    <p><strong>地址：</strong>${order.address}</p>
                    <p><strong>下单时间：</strong>${new Date(order.order_time).toLocaleString('zh-CN')}</p>
                    <p><strong>订单状态：</strong><span class="status-badge status-${order.status}">${statusText}</span></p>
                    <p><strong>订单总额：</strong><span class="total-amount">￥ ${order.total_amount}</span></p>
                </div>
            `;

            // 菜品明细表格
            const itemsTable = `
                <div class="order-items">
                    <h4>菜品明细</h4>
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th>菜品名称</th>
                                <th>单价</th>
                                <th>数量</th>
                                <th>小计</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map(item => `
                                <tr>
                                    <td>￥${item.name}</td>
                                    <td>￥${item.price}</td>
                                    <td>￥${item.quantity}</td>
                                    <td>￥${item.subtotal}</td>
                                </tr>
                            `).join('')}
                            <tr class="total-row">
                                <td colspan="3"><strong>总计</strong></td>
                                <td><strong>￥ ${order.total_amount}</strong></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;

            content.innerHTML = orderInfo + itemsTable;
        }

        // 关闭模态框事件
        orderModal.querySelector('.close').onclick = () => {
            orderModal.style.display = 'none';
        };
        window.onclick = (e) => {
            if (e.target === orderModal) {
                orderModal.style.display = 'none';
            }
        };

        // 初次加载
        loadOrders();
        // 每30秒自动刷新订单列表
        setInterval(loadOrders, 30000);
    }
})();