import "./sidebar.css";

function Sidebar({ categories, selectedCategory, onSelectCategory, onDeleteCategory }) {
    return (
        <aside className="sidebar">
            <p className="sidebar-title">Categories</p>
            <ul>
                {categories.length === 0 && (
                    <p className="sidebar-empty">No categories yet</p>
                )}
                {categories.map(cat => (
                    <li
                        key={cat._id}
                        className={`sidebar-item ${selectedCategory?._id === cat._id ? "active" : ""}`}
                        onClick={() => onSelectCategory(cat)}
                    >
                        <span>{cat.name}</span>
                        <div className="sidebar-item-right">
                            <span className="count">{cat.emailCount ?? 0}</span>
                            <button
                                className="delete-cat-btn"
                                title="Delete category"
                                onClick={e => {
                                    e.stopPropagation();
                                    if (confirm(`Delete "${cat.name}" and all its emails?`)) {
                                        onDeleteCategory(cat._id);
                                    }
                                }}
                            >✕</button>
                        </div>
                    </li>
                ))}
            </ul>
        </aside>
    );
}

export default Sidebar;
