import { useEffect, useRef, useState } from 'react';
import Header from '../Header/Header';
import './UpdateEquipment.sass';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFloppyDisk, faPlus, faArrowUpFromBracket, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import UploadImage from './UploadImage/UploadImage';
import { db } from '../firebase/firebase';
import { doc, getDoc, query, setDoc, updateDoc } from 'firebase/firestore';
import { uid } from 'uid';
import { Link, useNavigate, useParams } from 'react-router-dom';

const UpdateEquipment = () => {

    const [loaded, setLoaded] = useState(false);

    const navigate = useNavigate();

    const titleRef = useRef('');
    const descriptionRef = useRef('');

    const [titleId, setTitleId] = useState('');

    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');

    const [selectedCategory, setSelectedCategory] = useState(0);
    const [blur, setBlur] = useState(false);

    const [topBarAdd1Upload, setTopBarAdd1Upload] = useState(false);
    const [topBarAdd2Upload, setTopBarAdd2Upload] = useState(false);
    const [topBarUpload, setTopBarUpload] = useState(false);
    const [footUpload, setFootUpload] = useState(false);
    const [light01Upload, setLight01Upload] = useState(false);
    const [light02Upload, setLight02Upload] = useState(false);
    const [light03Upload, setLight03Upload] = useState(false);
    const [light04Upload, setLight04Upload] = useState(false);
    const [light05Upload, setLight05Upload] = useState(false);

    const [otherCategoryUpload, setOtherCategoryUpload] = useState(false);

    const [topBarAdd1Data, setTopBarAdd1Data] = useState({img: null, imgName: null});
    const [topBarAdd2Data, setTopBarAdd2Data] = useState({img: null, imgName: null});
    const [topBarData, setTopBarData] = useState({img: null, imgName: null});
    const [footData, setFootData] = useState({img: null, imgName: null});
    const [light01Data, setLight01Data] = useState({img: null, imgName: null});
    const [light02Data, setLight02Data] = useState({img: null, imgName: null});
    const [light03Data, setLight03Data] = useState({img: null, imgName: null});
    const [light04Data, setLight04Data] = useState({img: null, imgName: null});
    const [light05Data, setLight05Data] = useState({img: null, imgName: null});

    const [otherCategoryData, setOtherCategoryData] = useState({img: null, imgName: null});

    const showTopBarAdd1 = topBarAdd1Data.img != null && topBarAdd1Data.imgName != null;
    const showTopBarAdd2 = topBarAdd2Data.img != null && topBarAdd2Data.imgName != null;
    const showTopBar = topBarData.img != null && topBarData.imgName != null;
    const showFoot = footData.img != null && footData.imgName != null;
    const showLight01 = light01Data.img != null && light01Data.imgName != null;
    const showLight02 = light02Data.img != null && light02Data.imgName != null;
    const showLight03 = light03Data.img != null && light03Data.imgName != null;
    const showLight04 = light04Data.img != null && light04Data.imgName != null;
    const showLight05 = light05Data.img != null && light05Data.imgName != null;

    const [titleRefMissing, setTitleRefMissing] = useState(false);
    const [topBarAdd1Missing, setTopBarAdd1Missing] = useState(false);
    const [topBarAdd2Missing, setTopBarAdd2Missing] = useState(false);
    const [topBarMissing, setTopBarMissing] = useState(false);
    const [footMissing, setFootMissing] = useState(false);
    const [light01Missing, setLight01Missing] = useState(false);
    const [light02Missing, setLight02Missing] = useState(false);
    const [light03Missing, setLight03Missing] = useState(false);
    const [light04Missing, setLight04Missing] = useState(false);
    const [light05Missing, setLight05Missing] = useState(false);

    const [otherCategoryMissing, setOtherCategoryMissing] = useState(false);

    const showOtherCategory = otherCategoryData.img != null && otherCategoryData.imgName != null;
    
    const id = useParams().id;

    useEffect(() => {

        let data;

        const fetchData = async () => {
            const q = query(doc(db, 'equipment', id));
            
            const querySnapshot = await getDoc(doc(db, 'equipment', id));
            data = querySnapshot.data(); 

            setSelectedCategory(data.category);

            if(data.category == 0) {
                if(data.contents.topBarAdd1) {
                    setTopBarAdd1Data({img: data.contents.topBarAdd, imgName: 'topBarAdd'});
                }

                if(data.contents.topBarAdd2) {
                    setTopBarAdd2Data({img: data.contents.topBarAdd, imgName: 'topBarAdd'});
                }

                if(data.contents.topBar) {
                    setTopBarData({img: data.contents.topBar, imgName: 'topBar'});
                }

                if(data.contents.foot) {
                    setFootData({img: data.contents.foot, imgName: 'foot'});
                }

                if(data.contents.light01) {
                    setLight01Data({img: data.contents.light01, imgName: 'light01'});
                }

                if(data.contents.light02) {
                    setLight02Data({img: data.contents.light02, imgName: 'light02'});
                }

                if(data.contents.light03) {
                    setLight03Data({img: data.contents.light03, imgName: 'light03'});
                }

                if(data.contents.light04) {
                    setLight04Data({img: data.contents.light04, imgName: 'light04'});
                }

                if(data.contents.light05) {
                    setLight05Data({img: data.contents.light05, imgName: 'light05'});
                }
            }

            setTitle(data.title);
            setDesc(data.description);

            console.log(data);

            setTitleId(data.titleId);

            setLoaded(true);
        }

        fetchData();
    }, [])

    const checkFilledForm = () => {
        let statement = false;
        
        console.log('titleRef: ' + titleRef.current.value == '')
        if(titleRef.current.value == '') {
            setTitleRefMissing(true);
        } else {
            setTitleRefMissing(false);
        }
        
        console.log('selectedCategory: ' + selectedCategory);

        if (selectedCategory == 1) {
            
            if(otherCategoryData != {img: null, imgName: null}) {
                setOtherCategoryMissing(true);
            } else if (otherCategoryData == {img: null, imgName: null}) {
                setOtherCategoryMissing(false);
            }

            console.log(`titleRef: ${titleRefMissing}`);
            console.log(`otherCategory: ${otherCategoryMissing}`);

            statement = titleRefMissing && otherCategoryMissing;
        }
        
        console.log(statement);
        if(statement) {
            console.log('Passt alles');
        } else {
            console.log('Da fehlt was');
        }
    }

    const saveUpdatedEquipment = async () => {

        if(selectedCategory == 0) {
            await setDoc(doc(db, "equipment", titleId), {
                title: titleRef.current.value,
                description: descriptionRef.current.value,
                category: 0,
                contents: {
                    topBarAdd1: topBarAdd1Data.img,
                    topBarAdd2: topBarAdd2Data.img,
                    topBar: topBarData.img,
                    foot: footData.img,
                    light01: light01Data.img,
                    light02: light02Data.img,
                    light03: light03Data.img,
                    light04: light04Data.img,
                    light05: light05Data.img,
                },
                titleId: titleId
            }).then(() => navigate('/'));
        } else if (selectedCategory == 1) {
            

            await updateDoc(doc(db, "equipment", titleId), {
                title: titleRef.current.value,
                description: descriptionRef.current.value,
                category: 1,
                contents: {
                    img: otherCategoryData.img
                },
                titleId: titleId
            }).then(() => navigate('/'));
        }
    }

    return loaded ? (
        <div className="NewEquipment">
            {blur ? <div className='blur'></div> : null}

            <Header pageName={'Equipment anpassen'} />

            {topBarAdd1Upload ? <UploadImage setUpload={setTopBarAdd1Upload} setBlur={setBlur} img={topBarAdd1Data} setImg={setTopBarAdd1Data} /> : null}
            {topBarAdd2Upload ? <UploadImage setUpload={setTopBarAdd2Upload} setBlur={setBlur} img={topBarAdd2Data} setImg={setTopBarAdd2Data} /> : null}
            {topBarUpload ? <UploadImage setUpload={setTopBarUpload} setBlur={setBlur} img={topBarData} setImg={setTopBarData} /> : null}
            {footUpload ? <UploadImage setUpload={setFootUpload} setBlur={setBlur} img={footData} setImg={setFootData} /> : null}
            {light01Upload ? <UploadImage setUpload={setLight01Upload} setBlur={setBlur} img={light01Data} setImg={setLight01Data} /> : null}
            {light02Upload ? <UploadImage setUpload={setLight02Upload} setBlur={setBlur} img={light02Data} setImg={setLight02Data} /> : null}
            {light03Upload ? <UploadImage setUpload={setLight03Upload} setBlur={setBlur} img={light03Data} setImg={setLight03Data} /> : null}
            {light04Upload ? <UploadImage setUpload={setLight04Upload} setBlur={setBlur} img={light04Data} setImg={setLight04Data} /> : null}
            {light05Upload ? <UploadImage setUpload={setLight05Upload} setBlur={setBlur} img={light05Data} setImg={setLight05Data} /> : null}
            {otherCategoryUpload ? <UploadImage setUpload={setOtherCategoryUpload} setBlur={setBlur} img={otherCategoryData} setImg={setOtherCategoryData} /> : null}

            <main>
                <div className="head"><Link to={'/'}><FontAwesomeIcon className='back-to-dashboard' icon={faArrowLeft} /></Link><h1>Equipment bearbeiten</h1></div>

                <div className="form">
                    <div className="left">
                        <h3>Typ des Equipments</h3>
                        <div className="category-selection">
                            <p className={selectedCategory == 0 ? 'selected' : ''} onClick={() => setSelectedCategory(0)}>Ständer</p>
                            <p className={selectedCategory == 1 ? 'selected' : ''} onClick={() => setSelectedCategory(1)}>Anderes</p>
                        </div>

                        <h3>Name</h3>
                        <input value={title} onChange={e => setTitle(e.currentTarget.value)} className='equipment-name' id={titleRefMissing ? 'missing' : null} ref={titleRef} type="text" placeholder='Name des Equipments...' required />

                        <h3>Beschreibung</h3>
                        <textarea value={desc} onChange={e => setDesc(e.currentTarget.value)} className='equipment-description' ref={descriptionRef} placeholder='Text der Beschreibung...'></textarea>
                    </div>
                    <div className={selectedCategory == 0 ? "right-0" : "right invisible"}>
                        <div className="top-bar-add-container">
                            {topBarAdd1Data ? (showTopBarAdd1 ? <img className='top-bar-add-1-img' src={topBarAdd1Data.img} onClick={() => setTopBarAdd1Upload(true)} /> : <div className="top-bar-add-1" id={topBarAdd1Missing ? 'bar-missing' : null} title='Top Bar Add' onClick={() => setTopBarAdd1Upload(true)}><FontAwesomeIcon icon={faPlus} /></div>) : null}
                            {topBarAdd2Data ? (showTopBarAdd2 ? <img className='top-bar-add-2-img' src={topBarAdd2Data.img} onClick={() => setTopBarAdd2Upload(true)} /> : <div className="top-bar-add-2" id={topBarAdd2Missing ? 'bar-missing' : null} title='Top Bar Add' onClick={() => setTopBarAdd2Upload(true)}><FontAwesomeIcon icon={faPlus} /></div>) : null}
                        </div>                        
                        {showTopBar ? <img className='top-bar-img' src={topBarData.img} onClick={() => setTopBarUpload(true)} /> : <div className="top-bar" id={topBarMissing ? 'bar-missing' : null} title='Top Bar' onClick={() => setTopBarUpload(true)}><FontAwesomeIcon icon={faPlus} /></div>}                       
                        {showFoot ? <img className='foot-img' src={footData.img} onClick={() => setFootUpload(true)} /> : <div className="foot" title='Foot' id={footMissing ? 'bar-missing' : null} onClick={() => setFootUpload(true)}><FontAwesomeIcon icon={faPlus} /></div>  }      

                        <div className="lights">
                            <div className="light-container">
                                {showLight01 ? <img className='light-01-img' src={light01Data.img} onClick={() => setLight01Upload(true)} /> : <div id={light01Missing ? 'bar-missing' : null} className="light-01 light" title='Light 01' onClick={() => setLight01Upload(true)}><FontAwesomeIcon icon={faPlus} /></div>}
                                {showLight02 ? <img className='light-02-img' src={light02Data.img} onClick={() => setLight02Upload(true)} />: <div id={light02Missing ? 'bar-missing' : null} className="light-02 light" title='Light 02' onClick={() => setLight02Upload(true)}><FontAwesomeIcon icon={faPlus} /></div>}

                            </div>
                            {showLight03 ? <img className='light-03-img' src={light03Data.img} onClick={() => setLight03Upload(true)} /> : <div id={light03Missing ? 'bar-missing' : null} className="light-03 light" title='Light 03' onClick={() => setLight03Upload(true)}><FontAwesomeIcon icon={faPlus} /></div>}
                            <div className="light-container">
                                {showLight04 ? <img className='light-04-img' src={light04Data.img} onClick={() => setLight04Upload(true)} /> : <div id={light04Missing ? 'bar-missing' : null} className="light-04 light" title='Light 04' onClick={() => setLight04Upload(true)}><FontAwesomeIcon icon={faPlus} /></div>}                    
                                {showLight05 ? <img className='light-05-img' src={light05Data.img} onClick={() => setLight05Upload(true)} /> : <div id={light05Missing ? 'bar-missing' : null} className="light-05 light" title='Light 05' onClick={() => setLight05Upload(true)}><FontAwesomeIcon icon={faPlus} /></div>}
                            </div>
                        </div>
                    </div>

                    <div className={selectedCategory == 1 ? "right-1" : "right invisible"}>
                        {showOtherCategory ? <img className='other-category-img' src={otherCategoryData.img} onClick={() => setOtherCategoryUpload(true)} /> : <div id={otherCategoryMissing ? 'other-category-missing' : null} className="other-category" onClick={() => setOtherCategoryUpload(true)}>
                            <FontAwesomeIcon icon={faArrowUpFromBracket} />
                            <p>Bild einfügen</p>
                        </div>}
                    </div>

                    <FontAwesomeIcon onClick={saveUpdatedEquipment} className='save-btn' icon={faFloppyDisk} type='submit' />
                </div>

                
            </main>
            
        </div>
    ) : null;
};

export default UpdateEquipment;