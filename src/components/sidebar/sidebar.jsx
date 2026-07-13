import "./sidebar.css";

function Sidebar({ categories, selectedCategory, onSelectCategory }) {
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
                        <span className="count">{cat.emailCount ?? 0}</span>
                    </li>
                ))}
            </ul>
        </aside>
    );
}

export default Sidebar;
