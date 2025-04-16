import './Header.sass';

import { db } from '../firebase/firebase';

import { collection, query, where, doc, getDoc, setDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';

import { Link, useNavigate } from 'react-router-dom';

const Header = ({ pageName }) => {

    const navigate = useNavigate();

    const [password, setPassword] = useState();

    useEffect(() => {
        const fetchData = async () => {
            const q = query(doc(db, "login", "info"));

            const querySnapshot = await getDoc(q);
            
            setPassword(querySnapshot.data().password);
        }     
        
        fetchData();
    }, []);

    const logoutHandler = async () => {
        await setDoc(doc(db, "login", "info"), {
            loginState: false,
            password: password
        });
        
        navigate('/login');
    }

    return (
        <header>
            <div className="left">
                <Link className='link' to='/'><h1 className='app-name'>Party Planer</h1></Link>
                <div className="bar"></div>
                <h1 className='page-name'>{ pageName }</h1>
            </div>

            <div className="right">
                <button className="logout-btn" onClick={logoutHandler}>Logout</button>
            </div>
        </header>
    );
}

export default Header;