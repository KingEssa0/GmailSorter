
function Sidebar() {
    return <div className="sidebar">
        <h2>Navigation</h2>
        <ul>
            {categories.map(category => (
                <li key={category.id}>
                    {category.name}
                </li>
            ))}
        </ul>
    </div>
}

export default Sidebar;