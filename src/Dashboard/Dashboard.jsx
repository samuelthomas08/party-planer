import './Dashboard.sass';

import Equipment from './Equipment/Equipment.jsx';
import Header from '../Header/Header.jsx';
import Places from './Places/Places.jsx';
import Footer from '../Footer/Footer.jsx';

const Dashboard = () => {
    return (
        <div className="Dashboard">
            <Header pageName={'Dashboard'} />

            <main>
                <Equipment />
                <Places />
            </main>

            <Footer />
        </div>
    );
}

export default Dashboard